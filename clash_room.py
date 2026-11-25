import argparse
import os
import subprocess
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parent
PAGES_URL = "http://127.0.0.1:4173/FPS-Shooter/"
NPM = "npm.cmd" if os.name == "nt" else "npm"


def run(command, *, env=None, check=True, capture_output=False):
    return subprocess.run(
        command,
        cwd=ROOT,
        env=env,
        check=check,
        text=True,
        capture_output=capture_output,
    )


def pages_environment():
    env = os.environ.copy()
    env["GITHUB_ACTIONS"] = "true"
    return env


def test():
    env = pages_environment()
    env["VITE_EDITOR"] = "1"
    run([NPM, "run", "build"], env=env)
    print(f"\nAperçu avec éditeur 3D : {PAGES_URL}")
    print("Arrête le serveur avec Ctrl+C.\n")
    try:
        run(
            [
                NPM,
                "run",
                "preview",
                "--",
                "--host",
                "127.0.0.1",
                "--port",
                "4173",
                "--strictPort",
            ],
            env=env,
        )
    except KeyboardInterrupt:
        print("\nAperçu arrêté.")


def upload():
    branch = run(
        ["git", "branch", "--show-current"], capture_output=True
    ).stdout.strip()
    if branch != "main":
        print(f"Branche actuelle : {branch or '(détachée)'}.")
        print("Le déploiement GitHub Pages se déclenche uniquement depuis main.")
        return 1

    staged = run(
        ["git", "diff", "--cached", "--quiet"], check=False
    ).returncode
    if staged != 0:
        print("Des changements sont déjà indexés. Committez-les séparément avant l'upload.")
        return 1

    changes = run(["git", "status", "--short"], capture_output=True).stdout.strip()
    if not changes:
        print("Aucun changement à envoyer.")
        return 0

    print("Changements qui seront envoyés :")
    print(changes)
    if input("\nContinuer et envoyer tous ces changements ? [o/N] ").strip().lower() not in {
        "o",
        "oui",
    }:
        print("Upload annulé.")
        return 0

    run([NPM, "run", "build"], env=pages_environment())
    message = input("Message du commit : ").strip()
    if not message:
        print("Le message de commit est obligatoire.")
        return 1

    run(["git", "add", "-A"])
    run(["git", "commit", "-m", message])
    run(["git", "push", "origin", "main"])
    print("Modifications envoyées. GitHub Actions va lancer le déploiement Pages.")
    return 0


def main():
    parser = argparse.ArgumentParser(
        description="Tester localement ou déployer CLASH//ROOM sur GitHub Pages."
    )
    parser.add_argument("action", choices=("test", "upload"))
    args = parser.parse_args()

    if args.action == "test":
        test()
        return 0
    return upload()


if __name__ == "__main__":
    try:
        sys.exit(main())
    except subprocess.CalledProcessError as error:
        print(f"Échec de la commande : {error.cmd}", file=sys.stderr)
        sys.exit(error.returncode or 1)
