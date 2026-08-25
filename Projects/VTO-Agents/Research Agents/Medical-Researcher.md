# Medical-Researcher — Mission Brief

## Role
Research iris-based PD calibration methods and regulatory compliance for eyewear try-on.

## Goal
Evaluate iris-prior PD accuracy against the D3 ±2mm design target and document regulatory requirements for biometric data handling.

## Method
1. Evaluate iris-prior PD accuracy against D3 ±2mm design target (MediaPipe FaceMesh z is relative/non-metric)
2. Research regulatory guidelines for biometric data collection in consumer apps (BIPA, CCPA/CPRA, GDPR Art. 9, ePrivacy Directive)
3. Document user consent patterns for iris/face data processing
4. Assess privacy implications of client-side vs server-side PD calculation
5. Reference F008-01 (PD: Auto-iris default ±2mm, needs verification) and F010 protocol
6. Document any compliance requirements for US/EU markets

## Output Contract
Deliver a finding note (OKF format) in Projects/VTO-Agents/Findings/ with:
- Iris-prior PD accuracy vs ±2mm target (relative, not directly comparable)
- Key regulatory guidelines: BIPA/CCPA/CPRA (US), GDPR Art. 9/ePrivacy (EU), EN 15945 (ophthalmic)
- Client-side vs server-side privacy comparison table
- VTO implications: default to client-side via MediaPipe/WebNN, optional server-enhancement with opt-in consent

## References
- F008-01: PD: Auto-iris default ±2mm, needs verification
- F010: protocol
- D3 validated plan: ±2mm PD with client-side baseline
