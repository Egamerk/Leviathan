/** Binary min-heap of numeric ids keyed by numeric priority. Allocation-free after warm-up. */
export class MinHeap {
	private readonly items = new Array<number>();
	private readonly priorities = new Array<number>();
	private count = 0;

	public size(): number {
		return this.count;
	}

	public clear(): void {
		this.count = 0;
	}

	public push(item: number, priority: number): void {
		let index = this.count;
		this.count += 1;
		this.items[index] = item;
		this.priorities[index] = priority;

		// Sift up.
		while (index > 0) {
			const parent = math.floor((index - 1) / 2);
			if (this.priorities[parent] <= priority) break;
			this.items[index] = this.items[parent];
			this.priorities[index] = this.priorities[parent];
			index = parent;
		}
		this.items[index] = item;
		this.priorities[index] = priority;
	}

	/** Removes and returns the lowest-priority item. Caller must check `size() > 0`. */
	public pop(): number {
		const top = this.items[0];
		this.count -= 1;
		if (this.count === 0) return top;

		const item = this.items[this.count];
		const priority = this.priorities[this.count];
		let index = 0;

		// Sift down.
		// eslint-disable-next-line no-constant-condition
		while (true) {
			const left = index * 2 + 1;
			if (left >= this.count) break;
			const right = left + 1;
			const child = right < this.count && this.priorities[right] < this.priorities[left] ? right : left;
			if (this.priorities[child] >= priority) break;
			this.items[index] = this.items[child];
			this.priorities[index] = this.priorities[child];
			index = child;
		}
		this.items[index] = item;
		this.priorities[index] = priority;
		return top;
	}
}
