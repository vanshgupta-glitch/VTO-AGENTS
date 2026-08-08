#!/usr/bin/env python3
"""
F007-001: PD Error Propagation Monte Carlo Simulation

Simulates the full error propagation chain from MediaPipe iris landmark jitter
through to PD estimate uncertainty as a function of:
  - Face distance (proxied by face-height in px)
  - Head yaw angle
  - HVID population variance (iris-diameter prior uncertainty)
  - Video resolution

Outputs a failure-boundary map: where the +/-2 mm PD claim holds/breaks.

Usage:
    python F007-001-pd-error-propagation.py

Requires: numpy (install: pip install numpy)
"""

import sys
import numpy as np

# Fix Windows console encoding for unicode
if sys.platform == 'win32':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass
from dataclasses import dataclass
from typing import Tuple

# ── Physical & measurement constants ──────────────────────────────────────

HVID_MEAN_MM = 11.7          # Horizontal Visible Iris Diameter, population mean
HVID_SIGMA_MM = 0.45         # Population SD (Hashemi 2017, n=600)
PD_MEAN_MM = 63.0            # Average adult PD
PD_TO_HEIGHT_RATIO = 0.11    # iris ~11% of face height (empirical from codebase)
IRIS_JITTER_STD_NORM = 0.0008  # Normalised coords (0–1), empirical from jitterProbe
YAW_JITTER_STD_DEG = 1.5     # Degrees RMS after One-Euro smoothing
PUPIL_JITTER_STD_NORM = 0.0005  # Normalised coords pupil-centre jitter
CAMERA_HFOV_DEG = 60.0       # Typical webcam
VIDEO_WIDTH_PX = 1280        # Common webcam resolution

N_TRIALS = 10_000            # Monte Carlo trials per grid point
GRID_RES = 20                # Resolution of the distance×yaw grid

FRAME_HEIGHT_RANGE = (100, 900)  # Face-height px range
YAW_RANGE_DEG = (0, 70)          # Yaw angle range


@dataclass
class ErrorBudget:
    """Holds a parsed error budget for one (distance, yaw) point."""
    face_height_px: float
    yaw_deg: float
    pd_sigma_mm: float
    sigma_iris_mm: float
    sigma_yaw_mm: float
    sigma_pupil_mm: float
    sigma_hvid_mm: float
    passes_2mm: bool


def iris_px(face_height_px: float) -> float:
    """Iris diameter in pixels given face-height in px."""
    return face_height_px * PD_TO_HEIGHT_RATIO


def mm_per_px(iris_dia_px: float, hvid_mm: float) -> float:
    """mm-per-pixel scale factor."""
    return hvid_mm / iris_dia_px


def frontal_pd_px(face_height_px: float, yaw_rad: float) -> float:
    """
    Frontal inter-pupil distance in pixels.
    The measured IPD in px foreshortens as cos(yaw); this undoes that.
    """
    # IPD fraction of face height (empirical ~0.59 for average face)
    ipd_ratio = 0.59
    ipd_px = face_height_px * ipd_ratio
    # Yaw correction: divide by cos(yaw) to get frontal equivalent
    cos_yaw = np.cos(yaw_rad)
    cos_yaw = np.clip(cos_yaw, 0.2, 1.0)  # Same guard as codebase
    return ipd_px / cos_yaw


def run_trial(
    face_height_px: float,
    yaw_rad: float,
    hvid_true: float,
    iris_jitter_px: float,
    pupil_jitter_px: float,
    yaw_noise_rad: float,
) -> float:
    """
    Simulate one PD measurement trial with all noise sources.
    Returns PD estimate in mm.
    """
    # True iris diameter in px (with jitter)
    iris_measured_px = iris_px(face_height_px) + iris_jitter_px

    # mm-per-px from (noisy) iris measurement
    mmp = mm_per_px(max(iris_measured_px, 1.0), hvid_true)

    # Inter-pupil distance with yaw noise
    yaw_measured = yaw_rad + yaw_noise_rad
    cos_yaw_measured = np.clip(np.cos(yaw_measured), 0.2, 1.0)

    ipd_measured_px = face_height_px * 0.59 + pupil_jitter_px
    frontal_ipd_px = ipd_measured_px / cos_yaw_measured

    pd_mm = frontal_ipd_px * mmp
    return pd_mm


def compute_error_budget(
    face_height_px: float,
    yaw_deg: float,
    n_trials: int = N_TRIALS,
) -> ErrorBudget:
    """
    Monte Carlo error budget for a given (distance, yaw) point.
    """
    yaw_rad = np.deg2rad(yaw_deg)

    # Scale jitter to this resolution: normalised coords → pixels
    iris_jitter_std_px = IRIS_JITTER_STD_NORM * VIDEO_WIDTH_PX
    pupil_jitter_std_px = PUPIL_JITTER_STD_NORM * VIDEO_WIDTH_PX
    yaw_jitter_std_rad = np.deg2rad(YAW_JITTER_STD_DEG)

    rng = np.random.RandomState(42)

    # Sample HVID population: this is a per-person systematic, not per-frame noise
    hvid_samples = rng.normal(HVID_MEAN_MM, HVID_SIGMA_MM, n_trials)

    # Per-frame noise
    iris_jitter = rng.normal(0, iris_jitter_std_px, n_trials)
    pupil_jitter = rng.normal(0, pupil_jitter_std_px, n_trials)
    yaw_noise = rng.normal(0, yaw_jitter_std_rad, n_trials)

    # True PD (without iris jitter — uses HVID sample, which varies per person)
    # But for sigma computation, we compare against the POPULATION mean PD
    # The dominant term is HVID variation: if true HVID ≠ 11.7, PD is biased

    pd_estimates = np.zeros(n_trials)
    for i in range(n_trials):
        pd_estimates[i] = run_trial(
            face_height_px, yaw_rad,
            hvid_samples[i],
            iris_jitter[i], pupil_jitter[i], yaw_noise[i],
        )

    # Total PD sigma (includes both HVID bias and per-frame noise)
    pd_sigma_mm = np.std(pd_estimates)

    # Decompose contributions:
    # 1. Iris jitter only (hold HVID at mean, zero yaw/pupil noise)
    pd_iris_only = np.zeros(n_trials)
    for i in range(n_trials):
        pd_iris_only[i] = run_trial(face_height_px, yaw_rad, HVID_MEAN_MM, iris_jitter[i], 0, 0)
    sigma_iris = np.std(pd_iris_only)

    # 2. Yaw noise only
    pd_yaw_only = np.zeros(n_trials)
    for i in range(n_trials):
        pd_yaw_only[i] = run_trial(face_height_px, yaw_rad, HVID_MEAN_MM, 0, 0, yaw_noise[i])
    sigma_yaw = np.std(pd_yaw_only)

    # 3. Pupil jitter only
    pd_pupil_only = np.zeros(n_trials)
    for i in range(n_trials):
        pd_pupil_only[i] = run_trial(face_height_px, yaw_rad, HVID_MEAN_MM, 0, pupil_jitter[i], 0)
    sigma_pupil = np.std(pd_pupil_only)

    # 4. HVID only (systematic bias)
    pd_hvid_only = np.zeros(n_trials)
    for i in range(n_trials):
        pd_hvid_only[i] = run_trial(face_height_px, yaw_rad, hvid_samples[i], 0, 0, 0)
    sigma_hvid = np.std(pd_hvid_only)

    # True PD at population mean HVID with zero noise
    true_pd = run_trial(face_height_px, yaw_rad, HVID_MEAN_MM, 0, 0, 0)

    # Check: does the estimate fall within ±2 mm of true PD at 95% CI?
    # For normal distribution, 95% CI ≈ ±1.96·σ
    passes_2mm = (1.96 * pd_sigma_mm) <= 2.0

    return ErrorBudget(
        face_height_px=face_height_px,
        yaw_deg=yaw_deg,
        pd_sigma_mm=pd_sigma_mm,
        sigma_iris_mm=sigma_iris,
        sigma_yaw_mm=sigma_yaw,
        sigma_pupil_mm=sigma_pupil,
        sigma_hvid_mm=sigma_hvid,
        passes_2mm=passes_2mm,
    )


def print_table(results: list[ErrorBudget], yaw_values: list[float]):
    """Print a formatted error budget table."""
    print("\n" + "=" * 90)
    print("PD ERROR BUDGET — σ_PD (mm) as function of face-height and yaw")
    print("=" * 90)
    print(f"{'Face Ht':>8} {'Yaw°':>6} {'σ_PD':>8} {'σ_iris':>8} {'σ_yaw':>8} {'σ_pup':>8} {'σ_HVID':>8} {'±2mm?':>8}")
    print("-" * 90)

    for r in results:
        flag = "✅" if r.passes_2mm else "❌"
        print(f"{r.face_height_px:>8.0f} {r.yaw_deg:>6.1f} {r.pd_sigma_mm:>8.2f} "
              f"{r.sigma_iris_mm:>8.2f} {r.sigma_yaw_mm:>8.2f} {r.sigma_pupil_mm:>8.2f} "
              f"{r.sigma_hvid_mm:>8.2f} {flag:>8}")


def run_grid() -> list[ErrorBudget]:
    """Run the full distance × yaw grid."""
    heights = np.linspace(*FRAME_HEIGHT_RANGE, GRID_RES)
    yaws = np.linspace(*YAW_RANGE_DEG, GRID_RES)

    results = []
    total = len(heights) * len(yaws)
    count = 0

    print(f"Running {N_TRIALS:,} trials × {total} grid points ({total * N_TRIALS:,} total)...")
    print()

    for fh in heights:
        for y in yaws:
            count += 1
            r = compute_error_budget(fh, y)
            results.append(r)
            if count % 20 == 0 or count == total:
                print(f"  [{count:>4}/{total}] fh={fh:.0f} yaw={y:.1f} σ_PD={r.pd_sigma_mm:.2f} "
                      f"{'✅' if r.passes_2mm else '❌'}")

    return results


def find_failure_boundary(results: list[ErrorBudget]) -> list[Tuple[float, float]]:
    """Find the (face_height, yaw) points where ±2 mm first fails."""
    # Group by yaw, find lowest face height that passes
    boundary = []
    unique_yaws = sorted(set(r.yaw_deg for r in results))

    for yaw in unique_yaws:
        yaw_results = sorted(
            [r for r in results if abs(r.yaw_deg - yaw) < 0.01],
            key=lambda r: r.face_height_px
        )
        # Find the first (lowest height) that passes
        for r in yaw_results:
            if r.passes_2mm:
                boundary.append((r.face_height_px, yaw))
                break
        else:
            # Even at max height it fails
            boundary.append((FRAME_HEIGHT_RANGE[1] + 100, yaw))

    return boundary


def print_boundary(boundary: list[Tuple[float, float]]):
    """Print the failure boundary."""
    print("\n" + "=" * 60)
    print("FAILURE BOUNDARY — minimum face-height for ±2 mm at 95% CI")
    print("=" * 60)
    print(f"{'Yaw°':>8} {'Min FH px':>12}")
    print("-" * 60)
    for fh, yaw in boundary:
        if fh <= FRAME_HEIGHT_RANGE[1]:
            print(f"{yaw:>8.1f} {fh:>12.0f}")
        else:
            print(f"{yaw:>8.1f} {'NEVER':>12}")


def summary_stats(results: list[ErrorBudget]):
    """Key summary statistics."""
    passing = sum(1 for r in results if r.passes_2mm)
    total = len(results)
    print(f"\n{'='*60}")
    print(f"SUMMARY: {passing}/{total} grid points pass ±2 mm at 95% CI ({100*passing/total:.1f}%)")

    # Dominant contributor at median distance
    mid_height = np.median([r.face_height_px for r in results])
    mid_results = [r for r in results if abs(r.face_height_px - mid_height) < 10]

    if mid_results:
        # At 0° yaw
        zero_yaw = [r for r in mid_results if r.yaw_deg < 1]
        if zero_yaw:
            r = zero_yaw[0]
            contributions = [
                ("HVID (systematic)", r.sigma_hvid_mm),
                ("Iris jitter", r.sigma_iris_mm),
                ("Yaw noise", r.sigma_yaw_mm),
                ("Pupil jitter", r.sigma_pupil_mm),
            ]
            contributions.sort(key=lambda x: -x[1])
            print(f"\nAt ~{mid_height:.0f} px face height, 0° yaw:")
            print(f"  Total σ_PD = {r.pd_sigma_mm:.2f} mm")
            print(f"  95% CI = ±{1.96 * r.pd_sigma_mm:.2f} mm")
            print("  Contributions:")
            for name, val in contributions:
                pct = 100 * val**2 / r.pd_sigma_mm**2
                print(f"    {name:>20s}: {val:.3f} mm ({pct:.0f}%)")


def main():
    print("F007-001: PD Error Propagation Monte Carlo")
    print("=" * 50)
    print(f"Trials per point: {N_TRIALS:,}")
    print(f"Grid: {GRID_RES}×{GRID_RES} = {GRID_RES**2} points")
    print(f"Iris jitter σ: {IRIS_JITTER_STD_NORM * VIDEO_WIDTH_PX:.2f} px")
    print(f"Yaw jitter σ: {YAW_JITTER_STD_DEG:.1f}°")
    print(f"HVID σ: {HVID_SIGMA_MM:.2f} mm")

    results = run_grid()

    # Print selected rows
    key_heights = [150, 250, 400, 640, 800]
    key_yaws = [0, 15, 30, 45, 60]
    selected = [
        r for r in results
        if any(abs(r.face_height_px - h) < 15 for h in key_heights)
        and any(abs(r.yaw_deg - y) < 2 for y in key_yaws)
    ]
    selected.sort(key=lambda r: (r.face_height_px, r.yaw_deg))
    print_table(selected, key_yaws)

    boundary = find_failure_boundary(results)
    print_boundary(boundary)

    summary_stats(results)

    print("\nDone.")


if __name__ == "__main__":
    main()