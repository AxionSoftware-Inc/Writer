from __future__ import annotations

from dataclasses import dataclass
from typing import Any

import sympy as sp
from sympy import latex


class MatrixSolverError(ValueError):
    pass


@dataclass
class MatrixSolveResult:
    status: str
    message: str
    payload: dict[str, Any]


def _build_matrix_contract(
    *,
    mode: str,
    rows: int,
    cols: int,
    rhs: sp.Matrix | None = None,
    solver_kind: str | None = None,
    tensor_order: int | None = None,
) -> dict[str, Any]:
    square = rows == cols
    checks = [
        {
            "id": "shape",
            "label": "Matrix shape",
            "status": "ok",
            "detail": f"{rows}x{cols}",
        },
        {
            "id": "family",
            "label": "Solve family",
            "status": "ok",
            "detail": mode,
        },
    ]
    review_notes: list[str] = []

    if mode == "systems":
        compatible_rhs = rhs is not None and rhs.rows == rows
        checks.append(
            {
                "id": "rhs",
                "label": "Right-hand side",
                "status": "ok" if compatible_rhs else "error",
                "detail": "RHS length matches the coefficient matrix." if compatible_rhs else "RHS vector length does not match matrix rows.",
            }
        )
        if solver_kind == "least_squares":
            review_notes.append("Least-squares output should be read together with residual and normal-equation audit.")
    else:
        checks.append(
            {
                "id": "square",
                "label": "Square structure",
                "status": "ok" if square else "info",
                "detail": "Square matrix." if square else "Rectangular structure.",
            }
        )

    if mode == "tensor":
        checks.append(
            {
                "id": "tensor_order",
                "label": "Tensor order",
                "status": "ok" if (tensor_order or 0) >= 3 else "warn",
                "detail": f"Detected order {tensor_order or 'unknown'}.",
            }
        )
        review_notes.append("Tensor lane is strongest as a structural audit and factor-readiness environment.")

    severity_order = {"ok": 0, "info": 1, "warn": 2, "error": 3}
    status = max(checks, key=lambda item: severity_order[item["status"]])["status"]
    hazard_count = 0
    if not square and mode in {"algebra", "decomposition", "transform"}:
        hazard_count += 1
    if solver_kind == "least_squares":
        hazard_count += 1
    if mode == "tensor":
        hazard_count += 1

    if status == "error":
        risk_level = "high"
        readiness_label = "blocked"
    elif mode == "tensor":
        risk_level = "medium"
        readiness_label = "research_review"
    elif solver_kind == "least_squares":
        risk_level = "medium"
        readiness_label = "research_review"
    elif status == "warn":
        risk_level = "medium"
        readiness_label = "research_review"
    else:
        risk_level = "low" if square or mode == "systems" else "medium"
        readiness_label = "publication_ready" if status == "ok" else "working"

    return {
        "status": status,
        "checks": checks,
        "risk_level": risk_level,
        "readiness_label": readiness_label,
        "hazard_count": hazard_count,
        "review_notes": review_notes,
    }


def _parse_scalar(value: str) -> sp.Expr:
    try:
        return sp.sympify(value, locals={"pi": sp.pi, "e": sp.E})
    except Exception as exc:
        raise MatrixSolverError(f"Matrix elementi o'qilmadi: {value}") from exc


def _parse_matrix(expression: str) -> sp.Matrix:
    rows = [
        [cell for cell in row.replace(",", " ").split() if cell]
        for row in expression.split(";")
        if row.strip()
    ]
    if not rows:
        raise MatrixSolverError("Matrix input bo'sh.")
    width = len(rows[0])
    if any(len(row) != width for row in rows):
        raise MatrixSolverError("Har bir matrix qatori bir xil uzunlikda bo'lishi kerak.")
    return sp.Matrix([[_parse_scalar(cell) for cell in row] for row in rows])


def _parse_vector(expression: str) -> sp.Matrix | None:
    cleaned = [row.strip() for row in expression.split(";") if row.strip()]
    if not cleaned:
        return None
    return sp.Matrix([[_parse_scalar(value)] for value in cleaned])


def _parse_tensor(expression: str) -> list[sp.Matrix]:
    slices = [segment.strip() for segment in expression.split("||") if segment.strip()]
    if not slices:
        raise MatrixSolverError("Tensor input bo'sh.")
    matrices = [_parse_matrix(segment) for segment in slices]
    first_shape = matrices[0].shape
    if any(matrix.shape != first_shape for matrix in matrices):
        raise MatrixSolverError("Har bir tensor slice bir xil shape'da bo'lishi kerak.")
    return matrices


def _parse_tensor_family(expression: str) -> dict[str, Any]:
    blocks = [segment.strip() for segment in expression.split("###") if segment.strip()]
    if not blocks:
        raise MatrixSolverError("Tensor input bo'sh.")
    parsed_blocks = [_parse_tensor(block) for block in blocks]
    first_shape = parsed_blocks[0][0].shape
    first_depth = len(parsed_blocks[0])
    for block in parsed_blocks:
        if len(block) != first_depth:
            raise MatrixSolverError("Har bir higher-order tensor blokida slice soni bir xil bo'lishi kerak.")
        if any(matrix.shape != first_shape for matrix in block):
            raise MatrixSolverError("Har bir higher-order tensor blokidagi slice shape'lari bir xil bo'lishi kerak.")
    rows, cols = first_shape
    if len(parsed_blocks) == 1:
        return {
            "order": 3,
            "shape": (rows, cols, first_depth),
            "blocks": parsed_blocks,
            "visual_slices": parsed_blocks[0],
        }
    return {
        "order": 4,
        "shape": (rows, cols, first_depth, len(parsed_blocks)),
        "blocks": parsed_blocks,
        "visual_slices": parsed_blocks[0],
    }


def _sparsity_ratio(matrix: sp.Matrix) -> float:
    total = matrix.rows * matrix.cols
    if total == 0:
        return 0.0
    non_zero = sum(1 for value in matrix if value != 0)
    return 1 - (non_zero / total)


def _tensor_sparsity_ratio(slices: list[sp.Matrix]) -> float:
    if not slices:
        return 0.0
    total = sum(matrix.rows * matrix.cols for matrix in slices)
    non_zero = sum(1 for matrix in slices for value in matrix if value != 0)
    if total == 0:
        return 0.0
    return 1 - (non_zero / total)


def _tensor_family_sparsity_ratio(family: dict[str, Any]) -> float:
    blocks: list[list[sp.Matrix]] = family["blocks"]
    total = 0
    non_zero = 0
    for block in blocks:
        total += sum(matrix.rows * matrix.cols for matrix in block)
        non_zero += sum(1 for matrix in block for value in matrix if value != 0)
    if total == 0:
        return 0.0
    return 1 - (non_zero / total)


def _tensor_block_norms(blocks: list[list[sp.Matrix]]) -> list[float]:
    norms: list[float] = []
    for block in blocks:
        try:
            value = float(sp.N(_tensor_frobenius_norm(block), 8))
        except Exception:
            value = 0.0
        norms.append(value)
    return norms


def _unfold_tensor(slices: list[sp.Matrix], mode: int) -> sp.Matrix:
    rows = slices[0].rows
    cols = slices[0].cols
    depth = len(slices)

    if mode == 1:
        data = []
        for row_index in range(rows):
            unfolded_row = []
            for slice_index in range(depth):
                unfolded_row.extend(slices[slice_index].row(row_index))
            data.append(unfolded_row)
        return sp.Matrix(data)

    if mode == 2:
        data = []
        for col_index in range(cols):
            unfolded_row = []
            for slice_index in range(depth):
                unfolded_row.extend(slices[slice_index].col(col_index))
            data.append(unfolded_row)
        return sp.Matrix(data)

    if mode == 3:
        data = []
        for slice_index in range(depth):
            unfolded_row = []
            for row_index in range(rows):
                unfolded_row.extend(slices[slice_index].row(row_index))
            data.append(unfolded_row)
        return sp.Matrix(data)

    raise MatrixSolverError(f"Unsupported tensor unfolding mode: {mode}")


def _tensor_frobenius_norm(slices: list[sp.Matrix]) -> sp.Expr:
    total = sp.Integer(0)
    for matrix in slices:
        for value in matrix:
            total += sp.simplify(value ** 2)
    return sp.sqrt(total)


def _tensor_entries(family: dict[str, Any]) -> dict[tuple[int, ...], sp.Expr]:
    entries: dict[tuple[int, ...], sp.Expr] = {}
    blocks: list[list[sp.Matrix]] = family["blocks"]
    for block_index, block in enumerate(blocks):
        for slice_index, matrix in enumerate(block):
            for row_index in range(matrix.rows):
                for col_index in range(matrix.cols):
                    value = sp.simplify(matrix[row_index, col_index])
                    if family["order"] == 3:
                        entries[(row_index, col_index, slice_index)] = value
                    else:
                        entries[(row_index, col_index, slice_index, block_index)] = value
    return entries


def _flatten_multi_index(indices: tuple[int, ...], dims: tuple[int, ...]) -> int:
    factor = 1
    value = 0
    for index, dim in zip(reversed(indices), reversed(dims)):
        value += index * factor
        factor *= dim
    return value


def _unfold_tensor_family(family: dict[str, Any], mode: int) -> sp.Matrix:
    shape: tuple[int, ...] = family["shape"]
    if mode < 1 or mode > len(shape):
        raise MatrixSolverError(f"Unsupported tensor unfolding mode: {mode}")
    entries = _tensor_entries(family)
    row_dim = shape[mode - 1]
    other_dims = shape[: mode - 1] + shape[mode:]
    col_dim = 1
    for dim in other_dims:
        col_dim *= dim
    data = [[sp.Integer(0) for _ in range(col_dim)] for _ in range(row_dim)]
    for index, value in entries.items():
        row_index = index[mode - 1]
        col_index = _flatten_multi_index(index[: mode - 1] + index[mode:], other_dims)
        data[row_index][col_index] = value
    return sp.Matrix(data)


def _mode_contractions(slices: list[sp.Matrix], probe: sp.Matrix | None) -> tuple[list[tuple[str, sp.Matrix]], list[str], str | None]:
    rows, cols = slices[0].shape
    depth = len(slices)
    if probe is None:
        return [], [], None

    details: list[tuple[str, sp.Matrix]] = []
    labels: list[str] = []

    if probe.rows == rows:
        contracted = sp.zeros(cols, depth)
        for col_index in range(cols):
            for slice_index in range(depth):
                value = sp.Integer(0)
                for row_index in range(rows):
                    value += sp.simplify(probe[row_index, 0] * slices[slice_index][row_index, col_index])
                contracted[col_index, slice_index] = sp.simplify(value)
        details.append(("Mode-1 contraction", contracted))
        labels.append(f"mode-1 -> {cols}x{depth}")

    if probe.rows == cols:
        contracted = sp.zeros(rows, depth)
        for row_index in range(rows):
            for slice_index in range(depth):
                value = sp.Integer(0)
                for col_index in range(cols):
                    value += sp.simplify(probe[col_index, 0] * slices[slice_index][row_index, col_index])
                contracted[row_index, slice_index] = sp.simplify(value)
        details.append(("Mode-2 contraction", contracted))
        labels.append(f"mode-2 -> {rows}x{depth}")

    if probe.rows == depth:
        contracted = sp.zeros(rows, cols)
        for slice_index, matrix in enumerate(slices):
            contracted += sp.simplify(probe[slice_index, 0]) * matrix
        details.append(("Mode-3 contraction", contracted))
        labels.append(f"mode-3 -> {rows}x{cols}")

    summary = ", ".join(labels) if labels else None
    return details, labels, summary


def _parse_tensor_operator(expression: str) -> tuple[int | None, sp.Matrix | None]:
    if not expression.strip():
        return None, None
    lowered = expression.strip().lower()
    if not lowered.startswith("mode"):
        return None, None
    if ":" not in expression:
        return None, None
    prefix, payload = expression.split(":", 1)
    digits = "".join(character for character in prefix if character.isdigit())
    if not digits:
        return None, None
    mode = int(digits)
    operator = _parse_matrix(payload.strip())
    return mode, operator


def _tensor_mode_product_shape(shape: tuple[int, ...], mode: int, operator: sp.Matrix) -> tuple[int, ...]:
    shape_list = list(shape)
    shape_list[mode - 1] = operator.rows
    return tuple(shape_list)


def _tensor_structural_audit(family: dict[str, Any]) -> dict[str, Any]:
    mode_ranks: list[int] = []
    singular_summaries: list[str] = []
    tucker_factor_summaries: list[str] = []
    cp_factor_summaries: list[str] = []
    shape: tuple[int, ...] = family["shape"]
    visual_slices: list[sp.Matrix] = family["visual_slices"]

    for axis in range(1, len(shape) + 1):
        unfolding = _unfold_tensor_family(family, axis)
        mode_ranks.append(int(unfolding.rank()))
        try:
            sigma = [float(sp.N(value, 8)) for value in unfolding.singular_values()]
            if sigma:
                singular_summaries.append(f"mode-{axis}: " + ", ".join(f"{value:.3f}" for value in sigma[:3]))
        except Exception:
            singular_summaries.append(f"mode-{axis}: pending")
        try:
            u_mat, singular_vals, _ = unfolding.singular_value_decomposition()
            factor_rank = max(1, min(int(unfolding.rank()), u_mat.cols))
            tucker_factor_summaries.append(f"U{axis}: {u_mat.rows}x{factor_rank}")
            if u_mat.cols:
                cp_factor_summaries.append(f"a{axis}: {u_mat.rows}x1")
        except Exception:
            tucker_factor_summaries.append(f"U{axis}: pending")

    rows, cols = visual_slices[0].shape
    depth = len(visual_slices)
    tensor_product_summary = None
    if depth >= 2:
        product_shape = (rows * rows, cols * cols)
        tensor_product_summary = f"Slice Kronecker product -> {product_shape[0]}x{product_shape[1]}"

    tucker_summary = "HOSVD core target " + "x".join(str(rank) for rank in mode_ranks)

    cp_summary = None
    tensor_eigen_summary = None
    try:
        mode1 = _unfold_tensor_family(family, 1)
        singular_values = [float(sp.N(value, 8)) for value in mode1.singular_values()]
        if singular_values:
            component_count = max(1, min(3, min(mode_ranks)))
            cp_summary = f"Starter CP components {component_count}, lead weight {singular_values[0]:.4f}"
    except Exception:
        cp_summary = None

    try:
        if family["order"] == 3 and rows == cols == depth:
            mean_slice = sum(visual_slices, sp.zeros(rows, cols)) / depth
            eigvals = mean_slice.eigenvals()
            if eigvals:
                dominant = max((abs(complex(sp.N(value, 8))), value) for value in eigvals.keys())[1]
                tensor_eigen_summary = f"Symmetric cubic eigen probe λ≈{sp.N(dominant, 6)}"
        elif family["order"] > 3:
            tensor_eigen_summary = "Higher-order eigen probe deferred to unfolding spectrum"
    except Exception:
        tensor_eigen_summary = None

    slice_norms: list[float] = []
    for matrix in visual_slices:
        try:
            value = float(sp.N(sp.sqrt(sum(sp.simplify(entry ** 2) for entry in matrix)), 8))
        except Exception:
            value = 0.0
        slice_norms.append(value)

    return {
        "mode_ranks": mode_ranks,
        "mode_singular_summaries": singular_summaries,
        "tensor_product_summary": tensor_product_summary,
        "tucker_summary": tucker_summary,
        "cp_summary": cp_summary,
        "tensor_eigen_summary": tensor_eigen_summary,
        "tensor_slice_norms": slice_norms,
        "tensor_block_norms": _tensor_block_norms(family["blocks"]),
        "tucker_factor_summaries": tucker_factor_summaries,
        "cp_factor_summaries": cp_factor_summaries,
    }


def _matrix_summary(matrix: sp.Matrix, mode: str, rhs: sp.Matrix | None) -> dict[str, Any]:
    rows, cols = matrix.shape
    square = rows == cols
    determinant = None
    trace = None
    inverse_available = False
    condition_number = None
    diagonalizable = None
    pivot_columns: list[int] = []
    spectral_radius = None
    decomposition_summary = None
    solver_kind = None
    stability_summary = None
    least_squares_summary = None
    factor_audit_summary = None
    svd_summary = None
    singular_value_magnitudes: list[float] = []
    iterative_summary = None
    sparse_summary = None
    if square:
        try:
            determinant = latex(sp.simplify(matrix.det()))
            trace = latex(sp.simplify(matrix.trace()))
            inverse_available = sp.simplify(matrix.det()) != 0
        except Exception:
            pass
        try:
            diagonalizable = bool(matrix.is_diagonalizable())
        except Exception:
            diagonalizable = None
        try:
            if inverse_available:
                singular_values = [sp.N(value, 8) for value in matrix.singular_values()]
                if singular_values:
                    sigma_max = max(float(value) for value in singular_values)
                    sigma_min = min(float(value) for value in singular_values if float(value) > 0)
                    condition_number = f"{(sigma_max / sigma_min):.4f}"
        except Exception:
            condition_number = None
        try:
            eigenvals = matrix.eigenvals()
            radii = [abs(complex(sp.N(value, 8))) for value in eigenvals.keys()]
            if radii:
                spectral_radius = f"{max(radii):.4f}"
        except Exception:
            spectral_radius = None
        try:
            qr_q, qr_r = matrix.QRdecomposition()
            parts = ["QR"]
            if matrix.is_symmetric():
                parts.append("symmetric")
            if bool(matrix.is_positive_definite):
                parts.append("positive_definite")
            decomposition_summary = ", ".join(parts)
        except Exception:
            decomposition_summary = None
        if condition_number and spectral_radius:
            stability_summary = f"k(A)в‰€{condition_number}, ПЃ(A)в‰€{spectral_radius}"
        elif condition_number:
            stability_summary = f"k(A)в‰€{condition_number}"
        elif spectral_radius:
            stability_summary = f"ПЃ(A)в‰€{spectral_radius}"
        try:
            singular_values = [float(sp.N(value, 8)) for value in matrix.singular_values()]
            if singular_values:
                singular_value_magnitudes = singular_values[:]
                svd_summary = ", ".join(f"{value:.4f}" for value in singular_values[:4])
                if decomposition_summary:
                    factor_audit_summary = f"{decomposition_summary}; lead Пѓ={singular_values[0]:.4f}"
                else:
                    factor_audit_summary = f"Lead singular value {singular_values[0]:.4f}"
        except Exception:
            svd_summary = None
            factor_audit_summary = decomposition_summary
    try:
        _, pivots = matrix.rref()
        pivot_columns = [int(index + 1) for index in pivots]
    except Exception:
        pivot_columns = []
    try:
        sparsity = _sparsity_ratio(matrix)
        sparse_summary = f"{sparsity * 100:.1f}% sparse"
    except Exception:
        sparse_summary = None
    if square:
        try:
            if matrix.is_symmetric():
                iterative_summary = "CG-ready" if bool(matrix.is_positive_definite) else "Jacobi-ready"
            else:
                iterative_summary = "Jacobi-ready"
        except Exception:
            iterative_summary = "Jacobi-ready"
    elif sparse_summary:
        iterative_summary = "LSQR-ready" if _sparsity_ratio(matrix) > 0.45 else iterative_summary

    return {
        "determinant": determinant,
        "trace": trace,
        "rank": str(matrix.rank()),
        "inverseAvailable": inverse_available,
        "eigenSummary": "Spectral lane active." if mode == "decomposition" and square else None,
        "systemSummary": f"RHS vector length {rhs.rows}" if mode == "systems" and rhs is not None else None,
        "conditionLabel": "Conditioning estimated" if condition_number else ("Square matrix" if square else "Rectangular matrix"),
        "shape": f"{rows}x{cols}",
        "conditionNumber": condition_number,
        "diagonalizable": diagonalizable,
        "pivotColumns": pivot_columns,
        "spectralRadius": spectral_radius,
        "decompositionSummary": decomposition_summary,
        "solverKind": solver_kind,
        "stabilitySummary": stability_summary,
        "leastSquaresSummary": least_squares_summary,
        "factorAuditSummary": factor_audit_summary,
        "svdSummary": svd_summary,
        "singularValueMagnitudes": singular_value_magnitudes,
        "iterativeSummary": iterative_summary,
        "sparseSummary": sparse_summary,
    }


def _build_2x2_system_trace(matrix: sp.Matrix, rhs: sp.Matrix) -> list[dict[str, Any]]:
    if matrix.shape != (2, 2) or rhs.shape != (2, 1):
        return []
    a11, a12 = matrix[0, 0], matrix[0, 1]
    a21, a22 = matrix[1, 0], matrix[1, 1]
    b1, b2 = rhs[0, 0], rhs[1, 0]
    steps: list[dict[str, Any]] = []
    if a11 != 0:
        factor = sp.simplify(a21 / a11)
        reduced_row2 = [sp.simplify(a21 - factor * a11), sp.simplify(a22 - factor * a12), sp.simplify(b2 - factor * b1)]
        steps.append(
            {
                "title": "Row Elimination",
                "summary": "Ikkinchi qator birinchi pivot yordamida tozalandi.",
                "latex": rf"R_2 \leftarrow R_2 - ({latex(factor)})R_1,\quad \left[\begin{{matrix}} {latex(a11)} & {latex(a12)} & {latex(b1)} \\ {latex(reduced_row2[0])} & {latex(reduced_row2[1])} & {latex(reduced_row2[2])} \end{{matrix}}\right]",
                "tone": "info",
            }
        )
    return steps


def _build_elimination_steps(matrix: sp.Matrix, rhs: sp.Matrix | None = None) -> list[dict[str, Any]]:
    augmented = matrix.row_join(rhs) if rhs is not None else matrix
    steps: list[dict[str, Any]] = [
        {
            "title": "Augmented Setup" if rhs is not None else "Matrix Setup",
            "summary": "Elimination uchun boshlang'ich matritsa tayyorlandi.",
            "latex": latex(augmented),
            "tone": "neutral",
        }
    ]

    try:
        echelon = augmented.echelon_form()
        steps.append(
            {
                "title": "Echelon Form",
                "summary": "Pivot struktura ochiq ko'rinishi uchun echelon form qurildi.",
                "latex": latex(echelon),
                "tone": "info",
            }
        )
    except Exception:
        pass

    try:
        rref_matrix, pivots = augmented.rref()
        steps.append(
            {
                "title": "Reduced Row Echelon Form",
                "summary": f"Pivot ustunlar: {', '.join(str(index + 1) for index in pivots) if pivots else 'none'}",
                "latex": latex(rref_matrix),
                "tone": "info",
            }
        )
    except Exception:
        pass

    return steps


def _build_square_steps(matrix: sp.Matrix, det: sp.Expr, inverse: sp.Matrix | None) -> list[dict[str, Any]]:
    steps: list[dict[str, Any]] = []
    if matrix.shape == (2, 2):
        a, b, c, d = matrix[0, 0], matrix[0, 1], matrix[1, 0], matrix[1, 1]
        steps.append(
            {
                "title": "2x2 Determinant Rule",
                "summary": "2x2 formula bo'yicha determinant hisoblandi.",
                "latex": rf"\det(A)=({latex(a)})({latex(d)})-({latex(b)})({latex(c)})={latex(det)}",
                "tone": "success",
            }
        )
    else:
        steps.append(
            {
                "title": "Determinant Evaluation",
                "summary": "Square matrix determinant symbolic hisoblandi.",
                "latex": rf"\det(A) = {latex(det)}",
                "tone": "success",
            }
        )

    if inverse is not None:
        steps.append(
            {
                "title": "Inverse Construction",
                "summary": "Determinant nol emasligi sabab inverse mavjud.",
                "latex": rf"A^{{-1}} = {latex(inverse)}",
                "tone": "success",
            }
        )
    else:
        steps.append(
            {
                "title": "Inverse Availability",
                "summary": "Determinant nol bo'lgani sabab inverse mavjud emas.",
                "latex": None,
                "tone": "warn",
            }
        )

    return steps


def _build_decomposition_steps(matrix: sp.Matrix) -> tuple[list[dict[str, Any]], str | None]:
    steps: list[dict[str, Any]] = []
    auxiliary_parts: list[str] = []

    try:
        l_mat, u_mat, _ = matrix.LUdecomposition()
        steps.append(
            {
                "title": "LU Factorization",
                "summary": "Matrix LU faktorizatsiya qilindi.",
                "latex": rf"L = {latex(l_mat)},\quad U = {latex(u_mat)}",
                "tone": "info",
            }
        )
        auxiliary_parts.append(rf"L = {latex(l_mat)},\ U = {latex(u_mat)}")
    except Exception:
        pass

    try:
        q_mat, r_mat = matrix.QRdecomposition()
        steps.append(
            {
                "title": "QR Factorization",
                "summary": "QR decomposition compare lane uchun tayyorlandi.",
                "latex": rf"Q = {latex(q_mat)},\quad R = {latex(r_mat)}",
                "tone": "info",
            }
        )
        auxiliary_parts.append(rf"Q = {latex(q_mat)},\ R = {latex(r_mat)}")
    except Exception:
        pass

    try:
        u_mat, singular_vals, v_mat = matrix.singular_value_decomposition()
        sigma_entries = ", ".join(latex(value) for value in singular_vals.diagonal())
        steps.append(
            {
                "title": "SVD Probe",
                "summary": "Singular value decomposition audit uchun tayyorlandi.",
                "latex": rf"\Sigma = \operatorname{{diag}}({sigma_entries})",
                "tone": "info",
            }
        )
        auxiliary_parts.append(rf"\Sigma = {latex(singular_vals)}")
    except Exception:
        pass

    try:
        if matrix.is_symmetric() and bool(matrix.is_positive_definite):
            chol = matrix.cholesky()
            steps.append(
                {
                    "title": "Cholesky Probe",
                    "summary": "Matrix simmetrik musbat aniqlangan bo'lgani uchun Cholesky mavjud.",
                    "latex": rf"L_c = {latex(chol)}",
                    "tone": "success",
                }
            )
            auxiliary_parts.append(rf"L_c = {latex(chol)}")
    except Exception:
        pass

    auxiliary_latex = r"\quad ".join(auxiliary_parts) if auxiliary_parts else None
    return steps, auxiliary_latex


def _build_iterative_probe(matrix: sp.Matrix, rhs: sp.Matrix) -> tuple[list[dict[str, Any]], str | None]:
    if matrix.rows != matrix.cols:
        return [], None
    if any(matrix[i, i] == 0 for i in range(matrix.rows)):
        return [], None

    try:
        d_mat = sp.diag(*[matrix[i, i] for i in range(matrix.rows)])
        r_mat = matrix - d_mat
        x0 = sp.zeros(matrix.cols, 1)
        x1 = d_mat.inv() * (rhs - r_mat * x0)
        x2 = d_mat.inv() * (rhs - r_mat * x1)
        return (
            [
                {
                    "title": "Jacobi Probe",
                    "summary": "Iterative lane uchun Jacobining dastlabki qadamlari qurildi.",
                    "latex": rf"x_1 = {latex(x1)},\quad x_2 = {latex(x2)}",
                    "tone": "info",
                }
            ],
            rf"x_2 = {latex(x2)}",
        )
    except Exception:
        return [], None


def solve_matrix(mode: str, expression: str, rhs_expression: str = "", dimension: str = "") -> MatrixSolveResult:
    if mode == "tensor":
        family = _parse_tensor_family(expression)
        slices = family["visual_slices"]
        operator_mode, operator_matrix = _parse_tensor_operator(rhs_expression)
        probe = None if operator_mode is not None else _parse_vector(rhs_expression)
        rows, cols = slices[0].shape
        depth = len(slices)
        frob = sp.simplify(_tensor_frobenius_norm(slices))
        structural = _tensor_structural_audit(family)
        mode_ranks = structural["mode_ranks"]
        sparse_summary = f"{_tensor_family_sparsity_ratio(family) * 100:.1f}% sparse"
        contraction_details, contraction_labels, contraction_summary = _mode_contractions(slices, probe)
        mode_product_summary = None
        if operator_mode is not None and operator_matrix is not None and operator_mode <= len(family["shape"]):
            source_dim = family["shape"][operator_mode - 1]
            if operator_matrix.cols == source_dim:
                output_shape = _tensor_mode_product_shape(family["shape"], operator_mode, operator_matrix)
                mode_product_summary = f"Mode-{operator_mode} product -> {'x'.join(str(value) for value in output_shape)}"
                contraction_labels.append(mode_product_summary)
            else:
                contraction_labels.append(f"mode-{operator_mode} operator shape mismatch")

        parser = {
            "expression_raw": expression,
            "expression_latex": r"\ |\ ".join(latex(matrix) for matrix in slices),
            "rhs_raw": rhs_expression,
            "dimension": dimension,
        }
        summary = {
            "determinant": None,
            "trace": None,
            "rank": str(max(mode_ranks)),
            "inverseAvailable": False,
            "eigenSummary": None,
            "systemSummary": None,
            "conditionLabel": "Tensor structural audit",
            "shape": f"{rows}x{cols}",
            "conditionNumber": None,
            "diagonalizable": None,
            "pivotColumns": [],
            "spectralRadius": None,
            "decompositionSummary": None,
            "solverKind": "tensor_audit",
            "stabilitySummary": "Tensor structural audit",
            "leastSquaresSummary": None,
            "factorAuditSummary": None,
            "svdSummary": None,
            "singularValueMagnitudes": [],
            "iterativeSummary": None,
            "sparseSummary": sparse_summary,
            "tensorSummary": "Rank-3 tensor audit complete",
            "tensorShape": "x".join(str(value) for value in family["shape"]),
            "tensorOrder": family["order"],
            "modeRanks": [str(rank) for rank in mode_ranks],
            "contractionSummary": contraction_summary if contraction_summary else mode_product_summary,
            "contractionDetails": contraction_labels,
            "tensorProductSummary": structural["tensor_product_summary"],
            "tuckerSummary": structural["tucker_summary"],
            "cpSummary": structural["cp_summary"],
            "tensorEigenSummary": structural["tensor_eigen_summary"],
            "tensorSliceNorms": structural["tensor_slice_norms"],
            "modeSingularSummaries": structural["mode_singular_summaries"],
            "tensorBlockNorms": structural["tensor_block_norms"],
            "tuckerFactorSummaries": structural["tucker_factor_summaries"],
            "cpFactorSummaries": structural["cp_factor_summaries"],
        }
        factor_sections = [structural["tucker_summary"], structural["cp_summary"], structural["tensor_eigen_summary"]]
        summary["factorAuditSummary"] = " | ".join(section for section in factor_sections if section) if any(factor_sections) else None
        diagnostics = {
            "shape": "x".join(str(value) for value in family["shape"]),
            "square": False,
            "rank": max(mode_ranks),
            "mode": mode,
            "condition_number": None,
            "pivot_columns": [],
            "diagonalizable": None,
        }
        diagnostics["contract"] = _build_matrix_contract(
            mode=mode,
            rows=rows,
            cols=cols,
            rhs=probe,
            solver_kind=summary.get("solverKind"),
            tensor_order=family["order"],
        )
        steps: list[dict[str, Any]] = [
            {
                "title": "Tensor Parse",
                "summary": "Tensor frontal slice oilasi symbolic obyektlarga ajratildi.",
                "latex": parser["expression_latex"],
                "tone": "neutral",
            },
            {
                "title": "Mode Unfolding Ranks",
                "summary": "Mode-1, mode-2 va mode-3 unfolding ranklari hisoblandi.",
                "latex": r",\quad ".join(f"r_{index + 1}={value}" for index, value in enumerate(mode_ranks)),
                "tone": "info",
            },
            {
                "title": "Frobenius Norm",
                "summary": "Tensor energiyasi Frobenius norm orqali o'lchandi.",
                "latex": rf"\| \mathcal{{T}} \|_F = {latex(frob)}",
                "tone": "success",
            },
        ]
        steps.append(
            {
                "title": "Tucker Audit",
                "summary": "Mode unfolding spectrumdan HOSVD core target chiqarildi.",
                "latex": structural["tucker_summary"],
                "tone": "info",
            }
        )
        if structural["tucker_factor_summaries"]:
            steps.append(
                {
                    "title": "Tucker Factors",
                    "summary": "Har bir mode uchun factor matrix shape eksport qilindi.",
                    "latex": r",\quad ".join(structural["tucker_factor_summaries"]),
                    "tone": "info",
                }
            )
        if structural["cp_summary"]:
            steps.append(
                {
                    "title": "CP Rank-1 Probe",
                    "summary": "Dominant singular directionlardan rank-1 CP starter estimate olindi.",
                    "latex": structural["cp_summary"],
                    "tone": "info",
                }
            )
        if structural["cp_factor_summaries"]:
            steps.append(
                {
                    "title": "CP Factor Shapes",
                    "summary": "Rank-1 CP starter uchun factor vector shape'lari chiqdi.",
                    "latex": r",\quad ".join(structural["cp_factor_summaries"]),
                    "tone": "info",
                }
            )
        if structural["tensor_eigen_summary"]:
            steps.append(
                {
                    "title": "Tensor Eigen Concept",
                    "summary": "Mean-slice eigen probe tensor spectrum intuition berdi.",
                    "latex": structural["tensor_eigen_summary"],
                    "tone": "info",
                }
            )
        if structural["tensor_product_summary"]:
            steps.append(
                {
                    "title": "Tensor Product Probe",
                    "summary": "Birinchi ikki frontal slice Kronecker mahsuloti audit uchun baholandi.",
                    "latex": structural["tensor_product_summary"],
                    "tone": "info",
                }
            )
        if mode_product_summary:
            steps.append(
                {
                    "title": "Mode-n Product",
                    "summary": "Operator matrix bilan mode-n mahsulot shape o'zgarishi baholandi.",
                    "latex": mode_product_summary,
                    "tone": "info",
                }
            )

        auxiliary_parts: list[str] = []
        for index, singular_summary in enumerate(structural["mode_singular_summaries"], start=1):
            steps.append(
                {
                    "title": f"Mode-{index} Spectrum",
                    "summary": "Unfolding singular values tensor siqilish strukturasi haqida signal berdi.",
                    "latex": singular_summary,
                    "tone": "info",
                }
            )
            auxiliary_parts.append(singular_summary)

        for title, contraction_matrix in contraction_details:
            latex_line = rf"{title} = {latex(contraction_matrix)}"
            steps.append(
                {
                    "title": title,
                    "summary": "Probe vector bilan mos o'lcham bo'yicha contraction qurildi.",
                    "latex": latex_line,
                    "tone": "info",
                }
            )
            auxiliary_parts.append(latex_line)

        auxiliary_latex = r"\quad ".join(auxiliary_parts) if auxiliary_parts else None

        return MatrixSolveResult(
            status="exact",
            message="Tensor lane result tayyor.",
            payload={
                "input": {
                    "mode": mode,
                    "expression": expression,
                    "rhs": rhs_expression,
                    "dimension": dimension,
                },
                "parser": parser,
                "diagnostics": diagnostics,
                "summary": summary,
                "exact": {
                    "method_label": "Tensor Structural Audit / HOSVD Starter",
                    "result_latex": rf"\| \mathcal{{T}} \|_F = {latex(frob)}",
                    "auxiliary_latex": auxiliary_latex,
                    "numeric_approximation": None,
                    "steps": steps,
                },
            },
        )

    matrix = _parse_matrix(expression)
    rhs = _parse_vector(rhs_expression)
    rows, cols = matrix.shape
    square = rows == cols

    parser = {
        "expression_raw": expression,
        "expression_latex": latex(matrix),
        "rhs_raw": rhs_expression,
        "dimension": dimension,
    }
    summary = _matrix_summary(matrix, mode, rhs)
    diagnostics = {
        "shape": f"{rows}x{cols}",
        "square": square,
        "rank": matrix.rank(),
        "mode": mode,
        "condition_number": summary.get("conditionNumber"),
        "pivot_columns": summary.get("pivotColumns", []),
        "diagonalizable": summary.get("diagonalizable"),
    }

    steps: list[dict[str, Any]] = [
        {
            "title": "Matrix Parse",
            "summary": "Matritsa symbolic obyektga aylantirildi.",
            "latex": latex(matrix),
            "tone": "neutral",
        },
        {
            "title": "Structural Audit",
            "summary": f"Shape {rows}x{cols}, rank {matrix.rank()} aniqlindi.",
            "latex": None,
            "tone": "info",
        },
    ]

    result_latex: str | None = None
    auxiliary_latex: str | None = None
    method_label = "Matrix Algebra"
    numeric_approximation: str | None = None

    if mode == "algebra":
        if square:
            det = sp.simplify(matrix.det())
            result_latex = rf"\det(A) = {latex(det)}"
            try:
                inverse = matrix.inv()
                auxiliary_latex = rf"A^{{-1}} = {latex(inverse)}"
                inverse_available = True
            except Exception:
                inverse = None
                inverse_available = False
                auxiliary_latex = "A^{-1} mavjud emas"
            summary["inverseAvailable"] = inverse_available
            steps.extend(_build_square_steps(matrix, det, inverse))
            if summary.get("conditionNumber"):
                steps.append({
                    "title": "Condition Estimate",
                    "summary": "Singular value nisbati orqali condition number hisoblandi.",
                    "latex": rf"\kappa(A) \approx {summary['conditionNumber']}",
                    "tone": "info",
                })
        else:
            result_latex = rf"\operatorname{{rank}}(A) = {matrix.rank()}"
            steps.append({
                "title": "Rectangular Audit",
                "summary": "Rectangular matrix uchun rank lane ishladi.",
                "latex": result_latex,
                "tone": "info",
            })

    elif mode == "systems":
        if rhs is None:
            raise MatrixSolverError("Linear systems lane uchun RHS vector kerak.")
        if rhs.rows != rows:
            raise MatrixSolverError("RHS vector uzunligi matrix qatorlariga mos emas.")
        method_label = "Linear System Solve"
        solver_kind = "direct"
        try:
            if rows == cols:
                try:
                    solution = matrix.gauss_jordan_solve(rhs)[0]
                except Exception:
                    solution = matrix.LUsolve(rhs)
            else:
                solution = matrix.solve_least_squares(rhs)
                method_label = "Least Squares Solve"
                solver_kind = "least_squares"
        except Exception as exc:
            raise MatrixSolverError(f"Sistema yechilmadi: {exc}") from exc
        result_latex = rf"x = {latex(solution)}"
        residual = sp.simplify(matrix * solution - rhs)
        auxiliary_latex = rf"r = {latex(residual)}"
        steps.extend(_build_elimination_steps(matrix, rhs))
        steps.extend(_build_2x2_system_trace(matrix, rhs))
        iterative_steps, iterative_aux = _build_iterative_probe(matrix, rhs)
        steps.extend(iterative_steps)
        steps.append({
            "title": "System Solve",
            "summary": "A x = b sistema symbolic yechildi." if solver_kind == "direct" else "Rectangular sistema least-squares rejimida yechildi.",
            "latex": result_latex,
            "tone": "success",
        })
        summary["systemSummary"] = "Exact solve available" if solver_kind == "direct" else "Least squares solve available"
        summary["solverKind"] = solver_kind
        if iterative_steps:
            summary["iterativeSummary"] = summary.get("iterativeSummary") or "Jacobi-ready"
            if iterative_aux:
                auxiliary_latex = f"{auxiliary_latex} \\quad {iterative_aux}" if auxiliary_latex else iterative_aux
        try:
            residual_norm = max(abs(complex(sp.N(value, 8))) for value in residual)
            summary["residualNorm"] = f"{residual_norm:.4e}"
        except Exception:
            summary["residualNorm"] = None
        if solver_kind == "least_squares":
            try:
                projected = sp.simplify(matrix.T * residual)
                projected_norm = max(abs(complex(sp.N(value, 8))) for value in projected)
                summary["leastSquaresSummary"] = f"normal residual {projected_norm:.2e}"
                summary["stabilitySummary"] = f"least-squares fit, residual {summary['residualNorm'] or 'pending'}"
                steps.append(
                    {
                        "title": "Normal Equation Audit",
                        "summary": "Least-squares optimality uchun A^T r audit qilindi.",
                        "latex": rf"A^T r = {latex(projected)}",
                        "tone": "info",
                    }
                )
            except Exception:
                summary["leastSquaresSummary"] = "normal residual pending"
        else:
            summary["leastSquaresSummary"] = "exact residual target"
            summary["stabilitySummary"] = f"direct solve, residual {summary['residualNorm'] or 'pending'}"

    elif mode == "decomposition":
        if not square:
            raise MatrixSolverError("Decomposition lane uchun square matrix kerak.")
        method_label = "Spectral Decomposition"
        eigenvals = matrix.eigenvals()
        spectrum_parts = [rf"{latex(key)}: {value}" for key, value in eigenvals.items()]
        result_latex = r"\{ " + ",\\ ".join(spectrum_parts) + r" \}"
        try:
            diagonalizable = bool(matrix.is_diagonalizable())
            auxiliary_latex = rf"\text{{Diagonalizable}} = {'true' if diagonalizable else 'false'}"
        except Exception:
            auxiliary_latex = None
        steps.append({
            "title": "Spectrum",
            "summary": "Eigenvalue oilasi symbolic hisoblandi.",
            "latex": result_latex,
            "tone": "success",
        })
        try:
            eigenvects = matrix.eigenvects()
            if eigenvects:
                first_value, _, vectors = eigenvects[0]
                if vectors:
                    steps.append({
                        "title": "Eigenvector Probe",
                        "summary": f"Birinchi eigenvalue {latex(first_value)} uchun eigenvector namunasi olindi.",
                        "latex": rf"v_1 = {latex(vectors[0])}",
                        "tone": "info",
                    })
        except Exception:
            pass
        decomposition_steps, decomposition_aux = _build_decomposition_steps(matrix)
        steps.extend(decomposition_steps)
        if decomposition_aux:
            auxiliary_latex = f"{auxiliary_latex} \\quad {decomposition_aux}" if auxiliary_latex else decomposition_aux
        summary["eigenSummary"] = "Eigen spectrum extracted"
        summary["diagonalizable"] = diagonalizable if 'diagonalizable' in locals() else summary.get("diagonalizable")

    elif mode == "transform":
        method_label = "Linear Transform"
        if rhs is not None and rhs.rows == cols:
            transformed = matrix * rhs
            result_latex = rf"T(v) = {latex(transformed)}"
            auxiliary_latex = rf"v = {latex(rhs)}"
        else:
            basis = sp.eye(cols)
            transformed_basis = matrix * basis
            result_latex = rf"T(E) = {latex(transformed_basis)}"
            auxiliary_latex = rf"E = {latex(basis)}"
        steps.append({
            "title": "Transform Preview",
            "summary": "Transform lane basis/vector mappingni tayyorladi.",
            "latex": result_latex,
            "tone": "success",
        })
    else:
        raise MatrixSolverError(f"Noma'lum matrix mode: {mode}")

    diagnostics["contract"] = _build_matrix_contract(
        mode=mode,
        rows=rows,
        cols=cols,
        rhs=rhs,
        solver_kind=summary.get("solverKind"),
    )

    return MatrixSolveResult(
        status="exact",
        message="Matrix lane result tayyor.",
        payload={
            "input": {
                "mode": mode,
                "expression": expression,
                "rhs": rhs_expression,
                "dimension": dimension,
            },
            "parser": parser,
            "diagnostics": diagnostics,
            "summary": summary,
            "exact": {
                "method_label": method_label,
                "result_latex": result_latex,
                "auxiliary_latex": auxiliary_latex,
                "numeric_approximation": numeric_approximation,
                "steps": steps,
            },
        },
    )
