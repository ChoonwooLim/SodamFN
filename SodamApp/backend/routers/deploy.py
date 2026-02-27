import subprocess
import os
import threading
from fastapi import APIRouter, Depends, HTTPException
from routers.auth import get_admin_user
from models import User as AuthUser

router = APIRouter(prefix="/deploy", tags=["Deploy"])

# Store deployment status
deploy_status = {
    "staff": {"status": "idle", "message": "", "url": "https://sodam-staff.pages.dev"},
    "admin": {"status": "idle", "message": "", "url": "https://sodamfn.twinverse.org"},
}

PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
STAFF_APP_DIR = os.path.join(PROJECT_ROOT, "staff-app")
FRONTEND_DIR = os.path.join(PROJECT_ROOT, "frontend")


def run_deploy(app_type: str, project_name: str, app_dir: str, api_url: str):
    """Run build + deploy in background thread"""
    try:
        deploy_status[app_type] = {"status": "building", "message": "빌드 중...", "url": deploy_status[app_type]["url"]}

        # Build
        env = os.environ.copy()
        env["VITE_API_URL"] = api_url
        build_result = subprocess.run(
            ["npm", "run", "build"],
            cwd=app_dir, capture_output=True, text=True, env=env, shell=True, timeout=120
        )
        if build_result.returncode != 0:
            deploy_status[app_type] = {
                "status": "error", "message": f"빌드 실패: {build_result.stderr[:500]}",
                "url": deploy_status[app_type]["url"]
            }
            return

        deploy_status[app_type]["status"] = "deploying"
        deploy_status[app_type]["message"] = "Cloudflare에 배포 중..."

        # Write _redirects for SPA
        dist_dir = os.path.join(app_dir, "dist")
        with open(os.path.join(dist_dir, "_redirects"), "w") as f:
            f.write("/*    /index.html   200\n")

        # Deploy
        deploy_result = subprocess.run(
            ["npx", "wrangler", "pages", "deploy", "dist", "--project-name", project_name, "--branch", "main"],
            cwd=app_dir, capture_output=True, text=True, shell=True, timeout=120
        )
        if deploy_result.returncode != 0:
            deploy_status[app_type] = {
                "status": "error", "message": f"배포 실패: {deploy_result.stderr[:500]}",
                "url": deploy_status[app_type]["url"]
            }
            return

        deploy_status[app_type] = {
            "status": "success", "message": "배포 완료! ✅",
            "url": deploy_status[app_type]["url"]
        }
    except subprocess.TimeoutExpired:
        deploy_status[app_type] = {
            "status": "error", "message": "타임아웃: 배포 시간이 초과되었습니다",
            "url": deploy_status[app_type]["url"]
        }
    except Exception as e:
        deploy_status[app_type] = {
            "status": "error", "message": f"오류: {str(e)[:500]}",
            "url": deploy_status[app_type]["url"]
        }


@router.get("/status")
def get_deploy_status(_admin: AuthUser = Depends(get_admin_user)):
    return {"status": "success", "data": deploy_status}


@router.post("/staff")
def deploy_staff(_admin: AuthUser = Depends(get_admin_user)):
    if deploy_status["staff"]["status"] in ("building", "deploying"):
        raise HTTPException(400, "이미 배포가 진행 중입니다")

    deploy_status["staff"] = {"status": "building", "message": "시작 중...", "url": deploy_status["staff"]["url"]}
    thread = threading.Thread(
        target=run_deploy,
        args=("staff", "sodam-staff", STAFF_APP_DIR, "https://sodamfn.twinverse.org")
    )
    thread.daemon = True
    thread.start()
    return {"status": "success", "message": "직원앱 배포가 시작되었습니다"}


@router.post("/admin")
def deploy_admin(_admin: AuthUser = Depends(get_admin_user)):
    if deploy_status["admin"]["status"] in ("building", "deploying"):
        raise HTTPException(400, "이미 배포가 진행 중입니다")

    deploy_status["admin"] = {"status": "building", "message": "시작 중...", "url": deploy_status["admin"]["url"]}
    thread = threading.Thread(
        target=run_deploy,
        args=("admin", "sodamfn", FRONTEND_DIR, "")
    )
    thread.daemon = True
    thread.start()
    return {"status": "success", "message": "관리자앱 배포가 시작되었습니다"}
