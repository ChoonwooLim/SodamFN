import paramiko
import sys

host = "192.168.219.101"
user = "stevenlim"
password = "Jiyeon71391796!"

try:
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(host, username=user, password=password)

    commands = [
        "source ~/.nvm/nvm.sh && pm2 jlist",
        "cd /mnt/341AFA2C1AF9EB2E/Projects/SodamFN && git status",
        "cd /mnt/341AFA2C1AF9EB2E/Projects/SodamFN && git fetch && git log -n 3 --oneline HEAD..origin/main",
    ]

    for cmd in commands:
        print(f"--- Running: {cmd} ---")
        stdin, stdout, stderr = ssh.exec_command(cmd)
        print("STDOUT:", stdout.read().decode('utf-8'))
        print("STDERR:", stderr.read().decode('utf-8'))

    ssh.close()
except Exception as e:
    print(f"SSH failed: {e}")
