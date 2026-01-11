#!/bin/bash

# GNOME Keyring Setup Script
# This script ensures the GNOME keyring environment variables are properly set

# Set GNOME keyring control
export GNOME_KEYRING_CONTROL=/run/user/1000/keyring

# Set keyring socket paths if needed
export GNOME_KEYRING_SOCKET=/run/user/1000/keyring/control
export SSH_AUTH_SOCK=/run/user/1000/keyring/ssh

# Add to .bashrc if not already present
if ! grep -q "GNOME_KEYRING_CONTROL" ~/.bashrc; then
    echo "" >> ~/.bashrc
    echo "# GNOME Keyring environment variables" >> ~/.bashrc
    echo "export GNOME_KEYRING_CONTROL=/run/user/1000/keyring" >> ~/.bashrc
    echo "export GNOME_KEYRING_SOCKET=/run/user/1000/keyring/control" >> ~/.bashrc
    echo "export SSH_AUTH_SOCK=/run/user/1000/keyring/ssh" >> ~/.bashrc
fi

echo "GNOME Keyring environment variables have been set."
echo "Keyring should now be available for encryption."
