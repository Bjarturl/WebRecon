#!/bin/bash

strip_url() {
    local url="$1"
    url="${url#*//}"
    url="${url%%/*}"
    url="${url##www.}"
    echo "$url"
}

ensure_trailing_slash() {
    local url="$1"
    [[ "$url" != */ ]] && url="$url/"
    echo "$url"
}

download_from_url() {
    local url="$1"
    echo "Downloading from $url"
    local base_dir=$(strip_url "$url")
    local full_dir="output/$base_dir/webdumper"
    mkdir -p "$full_dir"
    url=$(ensure_trailing_slash "$url")
    node scripts/lib/downloader/index.js -u "$url" -o "$full_dir"
}

################################################################################################
################################################################################################
echo "Downloading all available files from Sources"

if [ -z "$1" ]; then
    while IFS= read -r url || [[ -n "$url" ]]; do
        stripped_url=$(strip_url "$url")
        download_from_url "$url"
        echo ""
    done <"websites.txt"
else
    download_from_url "$1"
fi
################################################################################################
