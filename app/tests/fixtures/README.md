# Media fixture

`polish-video.mp4` is a locally generated 320×180 H.264 MP4, about 2.2 seconds,
with a moving blue rectangle on a charcoal canvas and no audio. It was recorded
from an HTML canvas with MediaRecorder in Chromium. It contains no user files or
third-party footage. The Teragram E2E suite serves it through HTTP Range responses
to verify actual decoding, seeking, volume/speed controls and HUD inactivity.
