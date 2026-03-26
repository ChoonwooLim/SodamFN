import paramiko

def deploy():
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect("192.168.219.101", username="stevenlim", password="Jiyeon71391796!", timeout=10)
    
    cmd = "cd /mnt/341AFA2C1AF9EB2E/Projects/SodamFN && git pull origin main"
    _, stdout, stderr = ssh.exec_command(cmd)
    print("----- GIT PULL -----")
    print(stdout.read().decode())
    print(stderr.read().decode())
    
    cmd_restart = "sudo systemctl restart sodamfn || docker restart dev-sodamfn || pm2 restart sodamfn || ps aux | grep uvicorn | awk '{print $2}' | sudo xargs kill"
    _, stdout, stderr = ssh.exec_command(cmd_restart)
    print("----- RESTART -----")
    print(stdout.read().decode())
    print(stderr.read().decode())
    
    ssh.close()

if __name__ == "__main__":
    deploy()
