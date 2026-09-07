# Headroom Bare-Metal Setup

This guide runs Headroom as an internal systemd sidecar for a bare-metal
llama-dash host. It targets Ubuntu 24.04 on x86_64.

The MVP uses Headroom only for its local compression endpoint. llama-dash keeps
ownership of client authentication, routing, upstream credentials, forwarding,
and request logging.

```text
client -> llama-dash -> Headroom (127.0.0.1:8787) -> selected upstream
```

Headroom is not exposed on the network and does not need Anthropic or OpenAI
credentials.

## Install Headroom

Create a dedicated service user and virtual environment. Ubuntu 24.04's system
Python 3.12 is supported by Headroom and avoids a virtualenv interpreter
symlink into a root-owned `uv` installation.

```bash
sudo useradd --system --home-dir /var/lib/headroom --create-home --shell /usr/sbin/nologin headroom
sudo install -d -o headroom -g headroom /opt/headroom
sudo apt install python3.12-venv
sudo -H -u headroom /usr/bin/python3.12 -m venv /opt/headroom/venv
sudo -u headroom /opt/headroom/venv/bin/pip install 'headroom-ai[proxy]==<version>'
```

Replace `<version>` with the approved Headroom release. Pin the same version in
any Compose deployment rather than using a floating image tag.

## Configure The Sidecar

Create the service environment file:

```bash
sudo install -d -m 0755 /etc/llama-dash
sudo tee /etc/llama-dash/headroom.env >/dev/null <<'EOF'
HEADROOM_HOST=127.0.0.1
HEADROOM_PORT=8787
HEADROOM_BEACON=off
HEADROOM_TELEMETRY=off
EOF
sudo chmod 0640 /etc/llama-dash/headroom.env
sudo chown root:headroom /etc/llama-dash/headroom.env
```

`HEADROOM_BEACON=off` and `HEADROOM_TELEMETRY=off` disable Headroom telemetry.
The MVP uses marker-free, lossless compression: the systemd unit
passes `--no-ccr --lossless`, so Headroom never injects a
`headroom_retrieve` tool, stores retrieval markers, or falls back to lossy
compression.

## Start The Service

Install the included unit and enable it:

```bash
sudo cp config/headroom.service.example /etc/systemd/system/headroom.service
sudo systemctl daemon-reload
sudo systemctl enable --now headroom
sudo systemctl status headroom
curl http://127.0.0.1:8787/health
```

The unit runs as the unprivileged `headroom` user, binds only to loopback, and
uses `/var/lib/headroom` as its writable state directory. A sidecar failure does
not stop llama-dash; matching requests must fall back to uncompressed forwarding.

Configure llama-dash with:

```ini
HEADROOM_BASE_URL=http://127.0.0.1:8787
```

Compression remains inactive until an enabled Context Compression policy matches
the request in llama-dash's Policies page.

For the llama-dash systemd unit, add:

```ini
[Unit]
After=headroom.service
Wants=headroom.service
```

Use `Wants`, not `Requires`, so the gateway remains available if Headroom is
down.

## Operations

```bash
systemctl status headroom
journalctl -u headroom -f
curl http://127.0.0.1:8787/health
sudo systemctl restart headroom
```

Upgrade by installing a new pinned version into the same environment and then
restarting the service:

```bash
sudo -u headroom /opt/headroom/venv/bin/pip install --upgrade 'headroom-ai[proxy]==<new-version>'
sudo systemctl restart headroom
```

## Compose Equivalent

The Compose service uses the same Headroom configuration but exposes it only on
the internal Compose network. The sole application-level difference is the URL:

```text
bare metal: HEADROOM_BASE_URL=http://127.0.0.1:8787
Compose:    HEADROOM_BASE_URL=http://headroom:8787
```

No Headroom port should be published to the host in the Compose configuration.
