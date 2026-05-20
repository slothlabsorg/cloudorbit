#!/usr/bin/env bash
# Bootstrap LocalStack with IAM roles needed for integration tests.
# Run after `docker compose up -d` and before `cargo test -- --ignored`.

set -euo pipefail

ENDPOINT="${AWS_ENDPOINT_URL:-http://localhost:4566}"

echo "Waiting for LocalStack at $ENDPOINT..."
for i in $(seq 1 30); do
  if curl -sf "$ENDPOINT/_localstack/health" | grep -q '"sts"'; then
    echo "LocalStack ready."
    break
  fi
  sleep 2
done

export AWS_ACCESS_KEY_ID=test
export AWS_SECRET_ACCESS_KEY=test
export AWS_DEFAULT_REGION=us-east-1
export AWS_ENDPOINT_URL="$ENDPOINT"

# Trust policy that allows any principal to assume the test roles.
TRUST_POLICY='{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":{"AWS":"*"},"Action":"sts:AssumeRole"}]}'
WEBID_TRUST='{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":{"Federated":"*"},"Action":"sts:AssumeRoleWithWebIdentity"}]}'

echo "Creating TestRole..."
aws iam create-role \
  --role-name TestRole \
  --assume-role-policy-document "$TRUST_POLICY" \
  --endpoint-url "$ENDPOINT" 2>/dev/null || echo "TestRole already exists"

echo "Creating ChainedRole..."
aws iam create-role \
  --role-name ChainedRole \
  --assume-role-policy-document "$TRUST_POLICY" \
  --endpoint-url "$ENDPOINT" 2>/dev/null || echo "ChainedRole already exists"

echo "Creating FederatedRole (WebIdentity trust)..."
aws iam create-role \
  --role-name FederatedRole \
  --assume-role-policy-document "$WEBID_TRUST" \
  --endpoint-url "$ENDPOINT" 2>/dev/null || echo "FederatedRole already exists"

echo "LocalStack setup complete."
