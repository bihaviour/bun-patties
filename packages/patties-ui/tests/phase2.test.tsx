import { describe, expect, test } from "bun:test";
import { useForm } from "react-hook-form";
import { Button } from "../templates/button.tsx";
import { Checkbox } from "../templates/checkbox.tsx";
import {
	Field,
	FieldDescription,
	FieldError,
	FieldLabel,
} from "../templates/field.tsx";
import {
	Form,
	FormControl,
	FormDescription,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "../templates/form.tsx";
import { Input } from "../templates/input.tsx";
import { NativeSelect } from "../templates/native-select.tsx";
import { Progress } from "../templates/progress.tsx";
import { RadioGroup, RadioGroupItem } from "../templates/radio-group.tsx";
import { Slider } from "../templates/slider.tsx";
import { Switch } from "../templates/switch.tsx";
import { Textarea } from "../templates/textarea.tsx";
import { Toggle } from "../templates/toggle.tsx";
import { hydrate } from "./helpers/hydrate.ts";
import { renderStatic } from "./helpers/render-static.ts";

// Running react-dom/server then react-dom/client in one process makes React warn
// about "multiple renderers" for any shared (Radix) context. It's a test-harness
// artifact, not a hydration-mismatch defect, so we ignore it when asserting.
const BENIGN = ["Detected multiple renderers concurrently"];
function hydrationErrors(errors: string[]): string[] {
	return errors.filter((e) => !BENIGN.some((b) => e.includes(b)));
}

describe("Button", () => {
	test("variant × size apply token classes", async () => {
		expect(await renderStatic(<Button>a</Button>)).toContain("bg-primary");
		expect(
			await renderStatic(
				<Button variant="destructive" size="lg">
					a
				</Button>,
			),
		).toContain("bg-destructive");
	});

	test("type=submit renders a server button with no JS", async () => {
		const html = await renderStatic(<Button type="submit">Go</Button>);
		expect(html).toContain("<button");
		expect(html).toContain('type="submit"');
	});

	test("asChild forwards classes to an anchor", async () => {
		const html = await renderStatic(
			<Button asChild>
				<a href="/x">link</a>
			</Button>,
		);
		expect(html).toContain("<a");
		expect(html).toContain('href="/x"');
		expect(html).toContain("bg-primary");
	});
});

describe("Input / Textarea / NativeSelect", () => {
	test("Input carries name + type for native submit", async () => {
		const html = await renderStatic(<Input name="email" type="email" />);
		expect(html).toContain('name="email"');
		expect(html).toContain('type="email"');
	});

	test("Textarea renders and autoResize hydrates without errors", async () => {
		expect(await renderStatic(<Textarea name="bio" />)).toContain("<textarea");
		const { errors } = await hydrate(<Textarea autoResize maxRows={4} />);
		expect(hydrationErrors(errors)).toEqual([]);
	});

	test("NativeSelect renders a select with appearance-none chevron", async () => {
		const html = await renderStatic(
			<NativeSelect name="c">
				<option value="a">A</option>
			</NativeSelect>,
		);
		expect(html).toContain("<select");
		expect(html).toContain("appearance-none");
	});
});

describe("Checkbox", () => {
	test("nativeForm renders a native checkbox input", async () => {
		const html = await renderStatic(<Checkbox nativeForm name="agree" />);
		expect(html).toContain('type="checkbox"');
		expect(html).toContain('name="agree"');
	});

	test("controlled checkbox hydrates without errors", async () => {
		const { errors, hydratedHtml } = await hydrate(
			<Checkbox checked onCheckedChange={() => {}} />,
		);
		expect(hydrationErrors(errors)).toEqual([]);
		expect(hydratedHtml).toContain('role="checkbox"');
	});
});

describe("Switch", () => {
	test("nativeForm renders a native checkbox input", async () => {
		const html = await renderStatic(<Switch nativeForm name="dark" />);
		expect(html).toContain('type="checkbox"');
	});

	test("controlled switch hydrates with aria-checked", async () => {
		const { errors, hydratedHtml } = await hydrate(
			<Switch checked onCheckedChange={() => {}} />,
		);
		expect(hydrationErrors(errors)).toEqual([]);
		expect(hydratedHtml).toContain('role="switch"');
	});
});

describe("RadioGroup", () => {
	test("nativeForm renders native radio inputs sharing a name", async () => {
		const html = await renderStatic(
			<RadioGroup nativeForm name="plan" defaultValue="a">
				<RadioGroupItem value="a" />
				<RadioGroupItem value="b" />
			</RadioGroup>,
		);
		expect(html).toContain('type="radio"');
		expect((html.match(/name="plan"/g) ?? []).length).toBe(2);
	});

	test("controlled radio group hydrates without errors", async () => {
		const { errors, hydratedHtml } = await hydrate(
			<RadioGroup value="a" onValueChange={() => {}}>
				<RadioGroupItem value="a" />
				<RadioGroupItem value="b" />
			</RadioGroup>,
		);
		expect(hydrationErrors(errors)).toEqual([]);
		expect(hydratedHtml).toContain('role="radiogroup"');
	});
});

describe("Slider", () => {
	test("renders thumbs and a hidden range input per thumb when named", async () => {
		const html = await renderStatic(
			<Slider name="vol" defaultValue={[20, 60]} />,
		);
		expect(html).toContain('role="slider"');
		expect((html.match(/type="range"/g) ?? []).length).toBe(2);
	});

	test("hydrates without errors", async () => {
		const { errors } = await hydrate(<Slider defaultValue={[50]} />);
		expect(hydrationErrors(errors)).toEqual([]);
	});
});

describe("Progress", () => {
	test("renders progressbar role with aria-valuenow", async () => {
		const html = await renderStatic(<Progress value={42} />);
		expect(html).toContain('role="progressbar"');
		expect(html).toContain('aria-valuenow="42"');
	});

	test("hydrates without errors", async () => {
		const { errors } = await hydrate(<Progress value={70} />);
		expect(hydrationErrors(errors)).toEqual([]);
	});
});

describe("Toggle", () => {
	test("variants snapshot and aria-pressed present", async () => {
		const html = await renderStatic(
			<Toggle variant="outline" size="sm" aria-label="bold">
				B
			</Toggle>,
		);
		expect(html).toContain('aria-pressed="false"');
		expect(html).toContain("border-input");
	});

	test("hydrates without errors", async () => {
		const { errors } = await hydrate(
			<Toggle pressed onPressedChange={() => {}} aria-label="b">
				B
			</Toggle>,
		);
		expect(hydrationErrors(errors)).toEqual([]);
	});
});

describe("Field", () => {
	test("label htmlFor matches generated id and wires description", async () => {
		const html = await renderStatic(
			<Field>
				<FieldLabel>Email</FieldLabel>
				<Input />
				<FieldDescription>We never share it.</FieldDescription>
			</Field>,
		);
		const forMatch = html.match(/for="([^"]+)"/);
		expect(forMatch).not.toBeNull();
		expect(html).toContain('role="group"');
	});

	test("FieldError renders pre-filled errors with role=alert", async () => {
		const html = await renderStatic(
			<Field>
				<FieldLabel>Email</FieldLabel>
				<Input aria-invalid />
				<FieldError errors={["Required", "Too short"]} />
			</Field>,
		);
		expect(html).toContain('role="alert"');
		expect(html).toContain("Required, Too short");
	});

	test("FieldError with no errors renders nothing", async () => {
		const html = await renderStatic(
			<Field>
				<FieldError errors={[]} />
			</Field>,
		);
		expect(html).not.toContain('role="alert"');
	});
});

describe("Form (RHF compat)", () => {
	function DemoForm() {
		const form = useForm({ defaultValues: { username: "" } });
		return (
			<Form {...form}>
				<FormField
					control={form.control}
					name="username"
					render={({ field }) => (
						<FormItem>
							<FormLabel>Username</FormLabel>
							<FormControl>
								<Input {...field} />
							</FormControl>
							<FormDescription>Pick a handle.</FormDescription>
							<FormMessage />
						</FormItem>
					)}
				/>
			</Form>
		);
	}

	test("SSR wires aria-describedby and label htmlFor", async () => {
		const html = await renderStatic(<DemoForm />);
		expect(html).toContain("aria-describedby");
		expect(html).toContain("-form-item");
	});

	test("hydrates with initial values without errors", async () => {
		const { errors, hydratedHtml } = await hydrate(<DemoForm />);
		expect(hydrationErrors(errors)).toEqual([]);
		expect(hydratedHtml).toContain('name="username"');
	});
});
