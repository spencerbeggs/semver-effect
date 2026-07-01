import { Order } from "effect";
import type { SemVer } from "../schemas/SemVer.js";

/**
 * Effect `Order.Order` instance for {@link SemVer} following SemVer 2.0.0
 * precedence rules. Delegates to `SemVer`'s `compare` instance method.
 *
 * @see {@link SemVerOrderWithBuild}
 * @see {@link https://semver.org/#spec-item-11 | SemVer 2.0.0 Section 11}
 * @public
 */
export const SemVerOrder: Order.Order<SemVer> = Order.make((a, b) => a.compare(b));

/**
 * Effect `Order.Order` instance for {@link SemVer} that additionally
 * compares build metadata when versions are otherwise equal.
 *
 * @see {@link SemVerOrder}
 * @public
 */
export const SemVerOrderWithBuild: Order.Order<SemVer> = Order.make((a, b) => {
	const base = a.compare(b);
	if (base !== 0) return base;

	const aHasBuild = a.build.length > 0;
	const bHasBuild = b.build.length > 0;
	if (!aHasBuild && bHasBuild) return -1;
	if (aHasBuild && !bHasBuild) return 1;

	const len = Math.min(a.build.length, b.build.length);
	for (let i = 0; i < len; i++) {
		if (a.build[i] < b.build[i]) return -1;
		if (a.build[i] > b.build[i]) return 1;
	}

	if (a.build.length !== b.build.length) {
		return a.build.length < b.build.length ? -1 : 1;
	}

	return 0;
});
