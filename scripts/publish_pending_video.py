#!/usr/bin/env python3
"""Comprime un video pendiente y lo agrega a data.json. Usado por el workflow
'Publicar video pendiente' (.github/workflows/publicar-video.yml)."""
import argparse
import json
import os
import re
import subprocess
import sys

PREFIX = {'ugc': 'ugc', 'marcaPersonal': 'mp', 'marcaVideos': 'vm'}


def slugify(s):
    s = s.strip().lower()
    s = re.sub(r'[^a-z0-9]+', '-', s)
    return re.sub(r'^-+|-+$', '', s) or 'video'


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--upload-id', required=True)
    ap.add_argument('--section', required=True)
    ap.add_argument('--label', required=True)
    ap.add_argument('--filename', required=True)
    ap.add_argument('--input-file', required=True)
    ap.add_argument('--data-json', default='data.json')
    args = ap.parse_args()

    if args.section not in PREFIX:
        print('Sección desconocida: ' + args.section, file=sys.stderr)
        sys.exit(1)

    with open(args.data_json, encoding='utf-8') as f:
        data = json.load(f)

    pending = data.get('pending', [])
    data['pending'] = [p for p in pending if p.get('id') != args.upload_id]

    section_list = data['portfolio'][args.section]
    base_id = PREFIX[args.section] + '-' + slugify(args.label)
    existing_ids = {item['id'] for item in section_list}
    video_id = base_id
    n = 2
    while video_id in existing_ids:
        video_id = base_id + '-' + str(n)
        n += 1

    os.makedirs('videos', exist_ok=True)
    out_path = 'videos/' + video_id + '.mp4'

    cmd = [
        'ffmpeg', '-y', '-i', args.input_file,
        '-vf', 'scale=1080:-2',
        '-c:v', 'libx264', '-crf', '23', '-preset', 'medium',
        '-c:a', 'aac', '-b:a', '128k',
        '-movflags', '+faststart',
        out_path,
    ]
    subprocess.run(cmd, check=True)

    max_order = max([item.get('order', 0) for item in section_list], default=0)
    section_list.append({
        'id': video_id,
        'src': out_path,
        'label': args.label,
        'visible': True,
        'order': max_order + 1,
        'poster': '',
    })
    data['portfolio'][args.section] = section_list

    with open(args.data_json, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
        f.write('\n')

    print('Publicado: ' + video_id)


if __name__ == '__main__':
    main()
