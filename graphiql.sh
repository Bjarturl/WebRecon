#!/bin/bash

if [ -z "$1" ]; then
    echo "Usage: $0 <url> <is_prismic>"
    exit 1
fi

if [ -z "$2" ]; then
    node scripts/graphql.js "$1"
else
    node scripts/prismic.js "$1"
fi
