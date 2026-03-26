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
        "source ~/.nvm/nvm.sh && pm2 logs orbitron --lines 100 --nostream",
    ]

    for cmd in commands:
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
