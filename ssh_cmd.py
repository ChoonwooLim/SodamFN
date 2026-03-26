import paramiko

def run_ssh():
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect("192.168.219.101", username="stevenlim", password="Jiyeon71391796!", timeout=10)
    
    # locate uvicorn
    _, stdout, _ = ssh.exec_command("ps aux | grep uvicorn | grep -v grep")
    lines = stdout.read().decode().strip().split("\n")
    print(lines)
    
    for line in lines:
        if not line: continue
        parts = line.split()
        if len(parts) > 1:
            pid = parts[1]
            _, o, _ = ssh.exec_command(f"ls -l /proc/{pid}/cwd")
            print(f"CWD for {pid}:", o.read().decode().strip())
            
    # Also find 'SodamFN' dir anywhere if it's there
    _, stdout, _ = ssh.exec_command("find / -maxdepth 4 -name 'SodamFN' -type d 2>/dev/null")
    print("Found SodamFN dirs:", stdout.read().decode().strip())
    
    ssh.close()

if __name__ == "__main__":
    run_ssh()
