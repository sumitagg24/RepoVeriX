"""``python -m app.benchmark`` command line interface."""

from __future__ import annotations

import argparse
import asyncio
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[3]
DEFAULT_CONFIG = PROJECT_ROOT / "bench" / "configs" / "experiments.json"
DEFAULT_OUT = PROJECT_ROOT / "bench" / "reports"


def _parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="repoverix-bench",
        description="RepoVeriX-Bench: evaluate audit configurations against seeded repositories.",
    )
    parser.add_argument("--root", type=Path, default=PROJECT_ROOT, help="project root for relative paths")
    sub = parser.add_subparsers(dest="command", required=True)

    run = sub.add_parser("run", help="execute configured experiments")
    run.add_argument("--config", type=Path, default=DEFAULT_CONFIG, help="experiment config JSON")
    run.add_argument("--out", type=Path, default=DEFAULT_OUT, help="output directory")
    run.add_argument("--repos", nargs="*", default=None, help="restrict to repository names")
    run.add_argument("--configs", nargs="*", default=None, help="restrict to configuration names")
    run.add_argument(
        "--storage",
        type=Path,
        default=None,
        help="directory for repository working copies (default: a temp workspace)",
    )

    list_p = sub.add_parser("list", help="show configured repositories and configurations")
    list_p.add_argument("--config", type=Path, default=DEFAULT_CONFIG, help="experiment config JSON")
    return parser


async def _run(args: argparse.Namespace) -> None:
    from app.benchmark.experiments import load_experiment_config, run_all

    config = load_experiment_config(args.config)
    if args.storage is not None:
        import os

        os.environ["REPOVERIX_REPOSITORY_STORAGE_DIR"] = str(args.storage.resolve())

    if args.repos:
        available = [r["name"] for r in config.get("repositories", [])]
        missing = [r for r in args.repos if r not in available]
        if missing:
            sys.exit(f"Unknown repositories: {', '.join(missing)}. Available: {', '.join(available)}")

    results = await run_all(
        args.config,
        args.out,
        root=args.root,
        only_repos=args.repos,
        only_configs=args.configs,
    )
    print(f"Wrote {len(results)} experiment result(s) to {args.out.resolve()}")
    print(f"Summary table: {(args.out / 'summary.md').resolve()}")


def _list(args: argparse.Namespace) -> None:
    from app.benchmark.experiments import load_experiment_config

    config = load_experiment_config(args.config)
    print("Configurations:", ", ".join(config.get("configurations", [])))
    for repo in config.get("repositories", []):
        print(f"- {repo['name']}  (source: {repo['path']}, ground truth: {repo['ground_truth']})")


def main(argv: list[str] | None = None) -> None:
    args = _parser().parse_args(argv)
    if args.command == "run":
        asyncio.run(_run(args))
    else:
        _list(args)


if __name__ == "__main__":
    main()
