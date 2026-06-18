#!/bin/bash
# Выполнить на сервере (веб-консоль VPS или если есть доступ по паролю):
# Вставьте ОДНУ строку ниже, заменив PASTE_PUBLIC_KEY на содержимое id_ed25519.pub

mkdir -p ~/.ssh && chmod 700 ~/.ssh
echo 'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIL6AA+ZZb6Z+QO/kkBSZCjmzTdi7MZkuRNS0RSaG6HAL win11-key' >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys
echo "Key installed"
