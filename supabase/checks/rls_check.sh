#!/bin/sh
# 로그인 없이(anon 키만으로) 카드를 읽을 수 없는지 확인. 카드가 1개 이상 있을 때 의미가 있다.
set -e
cd "$(dirname "$0")/../.."
. ./.env.local
body=$(curl -s "$VITE_SUPABASE_URL/rest/v1/cards?select=id" -H "apikey: $VITE_SUPABASE_ANON_KEY")
if [ "$body" = "[]" ]; then echo "OK: 비로그인 접근 차단됨"; else echo "FAIL: 비로그인으로 카드가 보임: $body"; exit 1; fi
