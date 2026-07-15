#!/usr/bin/env bash

juanie_base_url="${JUANIE_BASE_URL:-https://juanie.art}"
juanie_oidc_audience="${JUANIE_OIDC_AUDIENCE:-juanie-ci}"
juanie_token=""
juanie_token_expires_at=0
JUANIE_HTTP_STATUS=""

require_juanie_identity_env() {
  local name="$1"
  if [ -z "${!name:-}" ]; then
    echo "${name} is required" >&2
    return 1
  fi
}

refresh_juanie_ci_token() {
  local now
  now="$(date +%s)"
  if [ -n "$juanie_token" ] && [ "$now" -lt "$juanie_token_expires_at" ]; then
    return
  fi

  require_juanie_identity_env ACTIONS_ID_TOKEN_REQUEST_URL
  require_juanie_identity_env ACTIONS_ID_TOKEN_REQUEST_TOKEN
  require_juanie_identity_env JUANIE_REPOSITORY
  require_juanie_identity_env JUANIE_RELEASE_REF
  require_juanie_identity_env JUANIE_SOURCE_SHA
  require_juanie_identity_env JUANIE_EXTERNAL_RUN_ID

  local separator='?'
  [[ "$ACTIONS_ID_TOKEN_REQUEST_URL" == *'?'* ]] && separator='&'
  local oidc_token
  oidc_token="$(
    curl -fsSL \
      -H "Authorization: Bearer ${ACTIONS_ID_TOKEN_REQUEST_TOKEN}" \
      "${ACTIONS_ID_TOKEN_REQUEST_URL}${separator}audience=${juanie_oidc_audience}" |
      jq -er '.value'
  )"

  local exchange_payload
  local exchange_response
  exchange_payload="$(
    jq -cn \
      --arg idToken "$oidc_token" \
      --arg repository "$JUANIE_REPOSITORY" \
      --arg ref "$JUANIE_RELEASE_REF" \
      --arg sha "$JUANIE_SOURCE_SHA" \
      --arg externalRunId "$JUANIE_EXTERNAL_RUN_ID" \
      '{idToken: $idToken, repository: $repository, ref: $ref, sha: $sha, externalRunId: $externalRunId}'
  )"
  exchange_response="$(
    curl -fsSL -X POST "${juanie_base_url}/api/auth/ci/exchange" \
      -H 'Content-Type: application/json' \
      -d "$exchange_payload"
  )"

  juanie_token="$(jq -er '.token' <<<"$exchange_response")"
  local expires_in
  expires_in="$(jq -er '.expiresIn' <<<"$exchange_response")"
  juanie_token_expires_at=$((now + expires_in - 30))
  echo "::add-mask::$juanie_token"
}

juanie_api_json() {
  local method="$1"
  local path="$2"
  local payload="$3"
  local output_file="$4"
  refresh_juanie_ci_token

  local curl_args=(
    -sS
    -o "$output_file"
    -w '%{http_code}'
    -X "$method"
    "${juanie_base_url}${path}"
    -H 'Content-Type: application/json'
    -H "Authorization: Bearer ${juanie_token}"
  )
  if [ -n "$payload" ]; then
    curl_args+=(-d "$payload")
  fi
  JUANIE_HTTP_STATUS="$(curl "${curl_args[@]}")"
}
