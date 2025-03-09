import os
import signal

def kill_process_on_port(port):
    try:
        result = os.popen(f"lsof -i :{port}").read()
        if result:
            pid = result.split("\n")[1].split()[1]
            os.kill(int(pid), signal.SIGKILL)
            print(f"Process on port {port} killed.")
        else:
            print(f"No process running on port {port}.")
    except Exception as e:
        print(f"Error: {e}")

# Example usage:
kill_process_on_port(5000)
