import {
	Children,
	cloneElement,
	isValidElement,
	type ReactElement,
	type ReactNode,
} from "react";

interface SlotProps {
	children?: ReactNode;
	[key: string]: unknown;
}

export function Slot({
	children,
	...slotProps
}: SlotProps): ReactElement | null {
	const child = Children.only(children);
	if (!isValidElement(child)) return null;
	const childEl = child as ReactElement<Record<string, unknown>>;
	return cloneElement(childEl, mergeProps(slotProps, childEl.props));
}

function mergeProps(
	parent: Record<string, unknown>,
	child: Record<string, unknown>,
): Record<string, unknown> {
	const merged: Record<string, unknown> = { ...parent };
	for (const key of Object.keys(child)) {
		const parentVal = parent[key];
		const childVal = child[key];
		if (
			key.startsWith("on") &&
			typeof parentVal === "function" &&
			typeof childVal === "function"
		) {
			merged[key] = (...args: unknown[]) => {
				(childVal as (...a: unknown[]) => unknown)(...args);
				(parentVal as (...a: unknown[]) => unknown)(...args);
			};
		} else if (key === "className") {
			merged[key] = [parentVal, childVal].filter(Boolean).join(" ");
		} else if (key === "style") {
			merged[key] = { ...(parentVal as object), ...(childVal as object) };
		} else {
			merged[key] = childVal;
		}
	}
	return merged;
}
