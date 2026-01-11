#!/bin/bash
set -e

echo "Fixing missing dependencies..."

cd node_modules

# Function to properly install a package
install_pkg() {
  local pkg=$1
  if [ ! -d "$pkg" ] || [ -z "$(ls -A $pkg 2>/dev/null)" ]; then
    echo "Installing $pkg..."
    rm -rf "$pkg"
    npm pack "$pkg" --ignore-scripts >/dev/null 2>&1 || return 1
    local tarball=$(ls ${pkg}-*.tgz 2>/dev/null | head -1)
    if [ -n "$tarball" ]; then
      mkdir -p "$pkg"
      tar -xzf "$tarball" --strip-components=1 -C "$pkg"
      rm -f "$tarball"
      echo "$pkg installed successfully"
      return 0
    fi
  fi
  return 1
}

# Install all missing critical packages
for pkg in uid uuid shortid; do
  install_pkg "$pkg" || echo "Failed to install $pkg (may not be needed)"
done

echo "Dependency fix complete"
