#!/usr/bin/env bash
# Generate the test media the mock server needs (needs ffmpeg with libvpx/libopus).
set -euo pipefail
cd "$(dirname "$0")/../mock" && mkdir -p media/{hls,frames,img} && cd media
ffmpeg -loglevel error -y -f lavfi -i testsrc2=size=1280x720:rate=24 -f lavfi -i sine=frequency=440 -t 180 \
  -c:v libvpx -deadline realtime -cpu-used 8 -b:v 400k -c:a libopus -shortest video.webm
ffmpeg -loglevel error -y -i video.webm -c:v libvpx-vp9 -deadline realtime -cpu-used 8 -b:v 500k -c:a libopus \
  -f hls -hls_time 6 -hls_playlist_type vod -hls_segment_type fmp4 -hls_fmp4_init_filename init.mp4 \
  -hls_segment_filename 'hls/seg%03d.m4s' hls/index.m3u8
ffmpeg -loglevel error -y -i video.webm -vf "fps=1/5,scale=320:180" frames/f%03d.jpg
for i in $(seq 1 8); do
  ffmpeg -loglevel error -y -f lavfi -i "gradients=size=600x900:seed=$((i*7)):duration=1" -frames:v 1 img/poster$i.jpg
  ffmpeg -loglevel error -y -f lavfi -i "gradients=size=1280x720:seed=$((i*13)):duration=1" -frames:v 1 img/art$i.jpg
done
echo "mock media ready"

# Ganymede mock: thumbnails, channel avatar, emote
mkdir -p g
for i in 1 2 3 4 5 6; do ffmpeg -loglevel error -y -f lavfi -i "gradients=size=640x360:seed=$i:duration=1" -frames:v 1 g/thumb$i.jpg; done
ffmpeg -loglevel error -y -f lavfi -i "color=c=0x4fd8c4:size=256x256" -frames:v 1 g/avatar.png
ffmpeg -loglevel error -y -f lavfi -i "color=c=0xffcc00:size=56x56" -frames:v 1 g/emote.png
echo "ganymede mock media ready"
