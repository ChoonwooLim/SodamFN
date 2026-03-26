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
        "echo 'Jiyeon71391796!' | sudo -S git config --global --add safe.directory /mnt/341AFA2C1AF9EB2E/Projects/SodamFN",
        "cd /mnt/341AFA2C1AF9EB2E/Projects/SodamFN && echo 'Jiyeon71391796!' | sudo -S git reset --hard origin/main && echo 'Jiyeon71391796!' | sudo -S git pull origin main",
        "echo 'Jiyeon71391796!' | sudo -S systemctl restart sodamfn"
    ]

    for cmd in commands:
        print(f"--- Running: {cmd} ---")
        stdin, stdout, stderr = ssh.exec_command(cmd)
        
        while True:
            line = stdout.readline()
            if not line:
                break
            print(line.strip())
            
        err = stderr.read().decode('utf-8')
        if err:
            print("STDERR:", err)

    ssh.close()
except Exception as e:
    print(f"SSH failed: {e}")
