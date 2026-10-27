//! Mount existing member dialogs locally without renaming, joining or deleting Telegram chats.
use super::{folder_groups, TelegramState};
use crate::{
    db::DbConnection,
    models::FolderMetadata,
    workspace::{store::Store, AccountGuard},
};
use grammers_client::types::Peer;
use grammers_tl_types::enums::Chat;
use serde::{Deserialize, Serialize};
use std::{collections::HashSet, path::Path};
use tauri::{Manager, State};

const RECORD: &str = "imported-channel-v1";
#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct MountedChannel {
    pub id: i64,
    pub name: String,
    pub username: Option<String>,
    pub attached: bool,
}
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ChannelChoice {
    id: i64,
    title: String,
    username: Option<String>,
    members: Option<i32>,
    kind: &'static str,
}
/// Basic groups occupy the negative namespace; channels/supergroups retain their IDs.
pub(crate) fn peer_id(peer: &Peer) -> Option<i64> {
    match peer {
        Peer::Channel(c) if !c.raw.left => Some(c.raw.id),
        Peer::Group(g) => match &g.raw {
            Chat::Channel(c) if !c.left => Some(c.id),
            Chat::Chat(c) if !c.left && !c.deactivated && c.migrated_to.is_none() => Some(-c.id),
            _ => None,
        },
        _ => None,
    }
}
fn choice(peer: &Peer) -> Option<ChannelChoice> {
    let id = peer_id(peer)?;
    let members = match peer {
        Peer::Channel(c) => c.raw.participants_count,
        Peer::Group(g) => match &g.raw {
            Chat::Channel(c) => c.participants_count,
            Chat::Chat(c) => Some(c.participants_count),
            _ => None,
        },
        _ => None,
    };
    Some(ChannelChoice {
        id,
        title: peer.name()?.to_owned(),
        username: peer.username().map(str::to_owned),
        members,
        kind: if matches!(peer, Peer::Channel(_)) {
            "channel"
        } else {
            "group"
        },
    })
}
pub(crate) fn mounts(root: &Path, owner: i64) -> Result<Vec<MountedChannel>, String> {
    Store::open(root, owner)?.records(RECORD)
}
pub(crate) fn imported(root: &Path, owner: i64, id: i64) -> Result<bool, String> {
    Ok(Store::open(root, owner)?
        .record::<MountedChannel>(RECORD, &id.to_string())?
        .is_some())
}
pub(crate) fn ensure_source_mutation_allowed(
    account: &AccountGuard,
    id: i64,
) -> Result<(), String> {
    account.validate()?;
    if imported(&account.root, account.owner, id)? {
        return Err(
            "Imported channels are managed in Telegram. Use Remove from Folders to detach locally."
                .into(),
        );
    }
    Ok(())
}
pub(crate) fn mirror(conn: &sqlite::Connection, account: &AccountGuard) -> Result<(), String> {
    account.validate()?;
    for entry in mounts(&account.root, account.owner)? {
        if entry.attached {
            let mut stmt = conn.prepare("INSERT INTO folder_metadata(channel_id,name,username,is_public,display_order,group_id) VALUES(?,?,?,?,(SELECT COALESCE(MAX(display_order),0)+1 FROM folder_metadata),NULL) ON CONFLICT(channel_id) DO NOTHING").map_err(|e|e.to_string())?;
            stmt.bind((1, entry.id)).map_err(|e| e.to_string())?;
            stmt.bind((2, entry.name.as_str()))
                .map_err(|e| e.to_string())?;
            stmt.bind((3, entry.username.as_deref()))
                .map_err(|e| e.to_string())?;
            stmt.bind((4, i64::from(entry.username.is_some())))
                .map_err(|e| e.to_string())?;
            stmt.next().map_err(|e| e.to_string())?;
        } else {
            let mut stmt = conn
                .prepare("DELETE FROM folder_metadata WHERE channel_id=?")
                .map_err(|e| e.to_string())?;
            stmt.bind((1, entry.id)).map_err(|e| e.to_string())?;
            stmt.next().map_err(|e| e.to_string())?;
        }
    }
    account.validate()
}
pub(crate) fn save_mounts(
    account: &AccountGuard,
    entries: &[MountedChannel],
) -> Result<(), String> {
    if entries.len() > 100
        || entries
            .iter()
            .any(|e| e.id == 0 || e.name.trim().is_empty() || e.name.len() > 1024)
    {
        return Err("Invalid channel selection".into());
    }
    let store = Store::open(&account.root, account.owner)?;
    store.transaction(|| {
        account.validate()?;
        for entry in entries {
            store.put_record(RECORD, &entry.id.to_string(), entry)?;
        }
        account.validate()
    })?;
    crate::file_inventory::invalidate(account.owner);
    crate::api_catalog::invalidate_cached(account.owner);
    Ok(())
}
fn account(app: &tauri::AppHandle, owner: &str) -> Result<AccountGuard, String> {
    AccountGuard::open(
        &app.path().app_data_dir().map_err(|e| e.to_string())?,
        Some(owner),
    )
}
#[tauri::command]
pub async fn cmd_get_imported_channel_ids(
    app: tauri::AppHandle,
    owner_id: String,
) -> Result<Vec<i64>, String> {
    let scope = account(&app, &owner_id)?;
    let result = mounts(&scope.root, scope.owner)?
        .into_iter()
        .filter(|e| e.attached)
        .map(|e| e.id)
        .collect();
    scope.validate()?;
    Ok(result)
}
#[tauri::command]
pub async fn cmd_list_import_channels(
    app: tauri::AppHandle,
    owner_id: String,
    state: State<'_, TelegramState>,
) -> Result<Vec<ChannelChoice>, String> {
    let scope = account(&app, &owner_id)?;
    let client = state
        .client
        .lock()
        .await
        .clone()
        .ok_or("Telegram is disconnected")?;
    scope.validate_client(&client).await?;
    let mut discovered = std::collections::HashMap::new();
    let result = tokio::time::timeout(std::time::Duration::from_secs(90), async {
        let mut dialogs = client.iter_dialogs();
        let mut rows = Vec::new();
        let mut seen = HashSet::new();
        while let Some(dialog) = dialogs.next().await.map_err(|e| e.to_string())? {
            scope.validate()?;
            if let Some(row) = choice(&dialog.peer) {
                if seen.insert(row.id) {
                    discovered.insert(row.id, dialog.peer.clone());
                    rows.push(row);
                }
            }
            if rows.len() >= 5000 {
                return Err(
                    "Too many dialogs; narrow your Telegram dialog list before importing".into(),
                );
            }
        }
        Ok::<_, String>(rows)
    })
    .await
    .map_err(|_| "Channel discovery timed out; retry when Telegram is reachable")??;
    {
        let mut cache = state.peer_cache.write().await;
        scope.validate()?;
        cache.extend(discovered);
    }
    Ok(result)
}
#[tauri::command]
pub async fn cmd_import_channels(
    app: tauri::AppHandle,
    owner_id: String,
    channel_ids: Vec<i64>,
    state: State<'_, TelegramState>,
    db_pool: State<'_, DbConnection>,
) -> Result<Vec<FolderMetadata>, String> {
    if channel_ids.is_empty() || channel_ids.len() > 100 {
        return Err("Select between 1 and 100 channels".into());
    }
    let scope = account(&app, &owner_id)?;
    let client = state
        .client
        .lock()
        .await
        .clone()
        .ok_or("Telegram is disconnected")?;
    scope.validate_client(&client).await?;
    let mut wanted: HashSet<i64> = channel_ids.into_iter().collect();
    let mut entries = Vec::new();
    let mut peers = Vec::new();
    tokio::time::timeout(std::time::Duration::from_secs(90), async {
        let mut dialogs = client.iter_dialogs();
        while let Some(dialog) = dialogs.next().await.map_err(|e| e.to_string())? {
            scope.validate()?;
            if let Some(row) = choice(&dialog.peer) {
                if wanted.remove(&row.id) {
                    entries.push(MountedChannel {
                        id: row.id,
                        name: row.title,
                        username: row.username,
                        attached: true,
                    });
                    peers.push((row.id, dialog.peer));
                }
            }
            if wanted.is_empty() {
                break;
            }
        }
        Ok::<_, String>(())
    })
    .await
    .map_err(|_| "Channel import timed out")??;
    scope.validate()?;
    if !wanted.is_empty() {
        return Err("Channel membership changed; refresh the channel list".into());
    }
    save_mounts(&scope, &entries)?;
    {
        let mut cache = state.peer_cache.write().await;
        scope.validate()?;
        for (id, peer) in peers {
            cache.insert(id, peer);
        }
    }
    let root = scope.root.clone();
    let owner = scope.owner;
    let folders = crate::db::with_connection(db_pool.inner().clone(), move |conn| {
        scope.validate()?;
        folder_groups::prepare_layout(conn, Some(&(root, Some(owner))))?;
        folder_groups::enriched_folders(conn)
    })
    .await?;
    // The frontend immediately refreshes the account catalog. Its existing bounded
    // inventory jobs index these mounted peers; no unbounded import download runs.
    Ok(folders)
}
#[tauri::command]
pub async fn cmd_remove_imported_channel(
    app: tauri::AppHandle,
    owner_id: String,
    channel_id: i64,
    db_pool: State<'_, DbConnection>,
) -> Result<(), String> {
    let scope = account(&app, &owner_id)?;
    let mut entry = Store::open(&scope.root, scope.owner)?
        .record::<MountedChannel>(RECORD, &channel_id.to_string())?
        .ok_or("Channel was not imported")?;
    entry.attached = false;
    save_mounts(&scope, &[entry])?;
    crate::db::with_connection(db_pool.inner().clone(), move |conn| mirror(conn, &scope)).await
}
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ChannelPreview {
    avatar: Option<String>,
    members: Option<i32>,
}
#[tauri::command]
pub async fn cmd_get_channel_details(
    app: tauri::AppHandle,
    owner_id: String,
    channel_id: i64,
    state: State<'_, TelegramState>,
) -> Result<ChannelPreview, String> {
    use base64::Engine;
    let scope = account(&app, &owner_id)?;
    let client = state
        .client
        .lock()
        .await
        .clone()
        .ok_or("Telegram is disconnected")?;
    scope.validate_client(&client).await?;
    let peer = tokio::time::timeout(
        std::time::Duration::from_secs(20),
        super::utils::resolve_peer(&client, Some(channel_id), &state.peer_cache),
    )
    .await
    .map_err(|_| "Channel preview lookup timed out")??;
    let mut members = choice(&peer).and_then(|row| row.members);
    if members.is_none() {
        let channel = match &peer {
            Peer::Channel(c) => Some(&c.raw),
            Peer::Group(g) => match &g.raw {
                Chat::Channel(c) => Some(c),
                _ => None,
            },
            _ => None,
        };
        if let Some(channel) = channel {
            let input = grammers_tl_types::enums::InputChannel::Channel(
                grammers_tl_types::types::InputChannel {
                    channel_id: channel.id,
                    access_hash: channel.access_hash.ok_or("Channel access is unavailable")?,
                },
            );
            if let Ok(Ok(full)) = tokio::time::timeout(
                std::time::Duration::from_secs(8),
                client.invoke(&grammers_tl_types::functions::channels::GetFullChannel {
                    channel: input,
                }),
            )
            .await
            {
                let grammers_tl_types::enums::messages::ChatFull::Full(full) = full;
                if let grammers_tl_types::enums::ChatFull::ChannelFull(details) = full.full_chat {
                    members = details.participants_count;
                }
            }
        }
    }
    scope.validate()?;
    let avatar = if let Some(photo) = peer.photo(false) {
        let download = tokio::time::timeout(std::time::Duration::from_secs(8), async {
            let mut stream = client.iter_download(&photo);
            let mut bytes = Vec::new();
            while let Some(chunk) = stream.next().await.map_err(|e| e.to_string())? {
                scope.validate()?;
                if bytes.len() + chunk.len() > 256 * 1024 {
                    return Err("Avatar exceeds preview limit".into());
                }
                bytes.extend(chunk);
            }
            Ok::<_, String>(bytes)
        })
        .await;
        match download {
            Ok(Ok(bytes)) => Some(format!(
                "data:image/jpeg;base64,{}",
                base64::engine::general_purpose::STANDARD.encode(bytes)
            )),
            _ => None,
        }
    } else {
        None
    };
    scope.validate()?;
    Ok(ChannelPreview { avatar, members })
}
