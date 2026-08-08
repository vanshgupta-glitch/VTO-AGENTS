#!/usr/bin/env python3
"""
F007-005: Statistical Validation Sample Size Calculator

Computes required sample sizes for PD accuracy validation using:
1. Two-sided tolerance intervals (95/95)
2. Bland-Altman limits of agreement
3. Power analysis for detecting improvements

Usage:
    python F007-005-validation-sample-size.py

Requires: numpy, scipy (install: pip install numpy scipy)
"""

import sys
import numpy as np
from scipy import stats

if sys.platform == 'win32':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass


# ── Tolerance Interval ─────────────────────────────────────────────────────

def tolerance_factor_k(n: int, P: float = 0.95, gamma: float = 0.95) -> float:
    """
    Two-sided tolerance factor for normal distribution (Howe 1969 approximation).
    k such that P(coverage >= P) = gamma for sample size n.

    k = z_{(1+P)/2} * sqrt((n-1) / chi2_{1-gamma, n-1})
    """
    z_p = stats.norm.ppf((1 + P) / 2)  # e.g., 1.96 for P=0.95
    chi2_g = stats.chi2.ppf(1 - gamma, df=n - 1)
    if chi2_g <= 0:
        return float('inf')
    return z_p * np.sqrt((n - 1) / chi2_g)


def tolerance_sample_size(sigma: float, tolerance_mm: float, P: float = 0.95, gamma: float = 0.95) -> int:
    """Find minimum n such that k(n) * sigma <= tolerance_mm."""
    for n in range(5, 200):
        k = tolerance_factor_k(n, P, gamma)
        if k * sigma <= tolerance_mm:
            return n
    return None


# ── Bland-Altman Sample Size ────────────────────────────────────────────────

def bland_altman_sample_size(s_d: float, loa_tolerance: float,
                              alpha: float = 0.05, power: float = 0.80) -> int:
    """
    Carkeet (2015): sample size for Bland-Altman 95% LoA.
    loa_tolerance: how precisely we want to estimate the LoA (half-width of CI)
    """
    z_alpha = stats.norm.ppf(1 - alpha / 2)
    z_beta = stats.norm.ppf(power)
    n = (z_alpha**2 * s_d**2 * (1 + z_beta**(-2))) / loa_tolerance**2
    return int(np.ceil(n))


# ── Power Analysis ──────────────────────────────────────────────────────────

def paired_power_sample_size(delta: float, sigma_diff: float,
                              alpha: float = 0.05, power: float = 0.80) -> int:
    """
    Sample size for paired t-test detecting effect size delta.
    """
    z_alpha = stats.norm.ppf(1 - alpha / 2)
    z_beta = stats.norm.ppf(power)
    n = 2 * (z_alpha + z_beta)**2 * sigma_diff**2 / delta**2
    return int(np.ceil(n))


# ── Main ────────────────────────────────────────────────────────────────────

def tolerance_table():
    """Print tolerance factors for different sample sizes."""
    print("\n" + "=" * 70)
    print("1. TWO-SIDED TOLERANCE FACTORS (95% confidence, 95% coverage)")
    print("=" * 70)
    print(f"{'n':>6} {'k factor':>10} {'sigma req':>12} {'(for +/-2mm)':>14}")
    print("-" * 70)

    for n in [5, 10, 15, 20, 25, 30, 40, 50, 75, 100, 150, 200]:
        k = tolerance_factor_k(n)
        sigma_req = 2.0 / k
        print(f"{n:>6} {k:>10.2f} {sigma_req:>12.3f} mm")


def bland_altman_table():
    """Print Bland-Altman sample sizes."""
    print("\n" + "=" * 70)
    print("2. BLAND-ALTMAN SAMPLE SIZES (LoA precision = 0.25 mm)")
    print("=" * 70)
    print(f"{'s_d (mm)':>10} {'n required':>12}")
    print("-" * 70)

    for s_d in [0.25, 0.35, 0.50, 0.75, 1.00, 1.50, 2.00, 2.50]:
        n = bland_altman_sample_size(s_d, 0.25)
        print(f"{s_d:>10.2f} {n:>12}")


def power_analysis():
    """Power analysis for detecting improvements."""
    print("\n" + "=" * 70)
    print("3. POWER ANALYSIS — Sample sizes for paired t-test (80% power, alpha=0.05)")
    print("=" * 70)
    print(f"{'delta mm':>10} {'sigma_diff':>12} {'n per group':>12}")
    print("-" * 70)

    for delta in [0.5, 1.0, 1.5, 2.0]:
        for sigma in [0.5, 1.0, 1.5]:
            n = paired_power_sample_size(delta, sigma)
            print(f"{delta:>10.1f} {sigma:>12.1f} {n:>12}")


def validation_scenarios():
    """Evaluate validation feasibility for different scenarios."""
    print("\n" + "=" * 70)
    print("4. VALIDATION FEASIBILITY BY SCENARIO")
    print("=" * 70)

    scenarios = [
        {
            "name": "Iris-prior only (current)",
            "sigma": 2.42,
            "description": "HVID population variance dominates"
        },
        {
            "name": "Card calibration, n=15",
            "sigma": 0.50,
            "description": "Per-person card + controlled yaw"
        },
        {
            "name": "Card calibration, n=20",
            "sigma": 0.50,
            "description": "Per-person card + controlled yaw"
        },
        {
            "name": "Card calibration, n=30",
            "sigma": 0.50,
            "description": "Per-person card + controlled yaw"
        },
        {
            "name": "Hybrid: iris + calibration factor",
            "sigma": 1.20,
            "description": "Population-tuned calibration factor"
        },
        {
            "name": "Iris-prior, relaxed (+/-4mm)",
            "sigma": 2.42,
            "description": "Claim: within +/-4 mm"
        },
    ]

    for s in scenarios:
        sigma = s['sigma']
        n_req = tolerance_sample_size(sigma, 2.0)
        k15 = tolerance_factor_k(15)
        k20 = tolerance_factor_k(20)
        k30 = tolerance_factor_k(30)

        passes = "PASS" if (n_req is not None and n_req <= 100) else "FAIL"
        ci15 = k15 * sigma
        ci30 = k30 * sigma

        print(f"\n  {s['name']}")
        print(f"    {s['description']}")
        print(f"    sigma = {sigma:.2f} mm")
        print(f"    n required for +/-2.0 mm: {n_req if n_req else '>200 (infeasible)'}")
        print(f"    With n=15: {ci15:.2f} mm, n=30: {ci30:.2f} mm")
        print(f"    Verdict: {passes}")


def pd_population_coverage():
    """What PD coverage can iris-prior claim?"""
    print("\n" + "=" * 70)
    print("5. IRIS-PRIOR PD COVERAGE (assuming HVID N(11.7, 0.45))")
    print("=" * 70)

    hvid_pop = np.random.RandomState(42).normal(11.7, 0.45, 100000)

    # PD error = (true_HVID / 11.7 - 1) * PD_true
    # For PD ~63 mm, error ~ (HVID/11.7 - 1) * 63
    pd_errors_mm = (hvid_pop / 11.7 - 1) * 63.0

    tolerances = [2, 3, 4, 5, 6]
    print(f"{'Tolerance':>12} {'Coverage %':>12}")
    print("-" * 30)
    for tol in tolerances:
        coverage = np.mean(np.abs(pd_errors_mm) <= tol) * 100
        print(f"{'+/-' + str(tol) + ' mm':>12} {coverage:>12.1f}%")


def main():
    print("F007-005: Statistical Validation Sample Size Calculator")
    print("=" * 60)

    tolerance_table()
    bland_altman_table()
    power_analysis()
    validation_scenarios()
    pd_population_coverage()

    print("\n" + "=" * 60)
    print("RECOMMENDATION")
    print("=" * 60)
    print("  With card calibration: n >= 20 subjects validates +/-2 mm at 95/95.")
    print("  With iris-prior only:   NO sample size validates +/-2 mm.")
    print("  Iris-prior valid claim: 'typically within +/-4 mm' (90% coverage).")
    print("  For +/-5 mm claim:      95% coverage without calibration.")


if __name__ == "__main__":
    main()