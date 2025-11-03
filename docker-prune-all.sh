#!/usr/bin/env bash
set -euo pipefail

# Docker total prune script (macOS/Linux portable)
# This script will:
# 1) Stop and remove ALL containers
# 2) Remove ALL images
# 3) Remove ALL volumes
# 4) Remove ALL custom networks (keeps default bridge/host/none)
# 5) Prune system/build caches

info() { printf "\033[1;34m[INFO]\033[0m %s\n" "$*"; }
success() { printf "\033[1;32m[DONE]\033[0m %s\n" "$*"; }
warn() { printf "\033[1;33m[WARN]\033[0m %s\n" "$*"; }

# Check docker availability
if ! command -v docker >/dev/null 2>&1; then
  warn "Docker não encontrado no PATH. Instale/abra o Docker Desktop e tente novamente."
  exit 127
fi

# Ensure Docker daemon is reachable
if ! docker info >/dev/null 2>&1; then
  warn "Docker daemon não está acessível. Abra o Docker Desktop ou inicie o serviço."
  exit 126
fi

# Stop and remove all containers
containers=$(docker ps -aq || true)
if [ -n "${containers}" ]; then
  info "Parando containers..."
  docker stop ${containers} >/dev/null 2>&1 || true
  info "Removendo containers..."
  docker rm -f ${containers} >/dev/null 2>&1 || true
else
  info "Nenhum container para remover."
fi

# Remove all images
images=$(docker images -aq || true)
if [ -n "${images}" ]; then
  info "Removendo imagens..."
  docker rmi -f ${images} >/dev/null 2>&1 || true
else
  info "Nenhuma imagem para remover."
fi

# Remove all volumes
vols=$(docker volume ls -q || true)
if [ -n "${vols}" ]; then
  info "Removendo volumes..."
  docker volume rm -f ${vols} >/dev/null 2>&1 || true
else
  info "Nenhum volume para remover."
fi

# Remove all custom networks (exclude default: bridge, host, none)
custom_nets=$(docker network ls --format '{{.Name}}' | grep -Ev '^(bridge|host|none)$' || true)
if [ -n "${custom_nets}" ]; then
  info "Removendo redes personalizadas..."
  # shellcheck disable=SC2086
  docker network rm ${custom_nets} >/dev/null 2>&1 || true
else
  info "Nenhuma rede personalizada para remover."
fi

# Prune system, build cache, buildx
info "Executando docker system prune..."
docker system prune -a --volumes -f >/dev/null 2>&1 || true

info "Executando docker builder prune..."
docker builder prune -a -f >/dev/null 2>&1 || true

# Optional: buildx (may not be installed)
if docker buildx version >/dev/null 2>&1; then
  info "Executando docker buildx prune..."
  docker buildx prune -a -f >/dev/null 2>&1 || true
fi

success "Prune total do Docker concluído."

