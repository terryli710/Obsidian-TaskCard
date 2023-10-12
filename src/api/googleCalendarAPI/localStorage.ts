
// Adopted from https://github.com/YukiGasai/obsidian-google-calendar/blob/master/src/helper/LocalStorage.ts




export class LocalStorageDB {
	private data: Record<string, any>; // In-memory database
	private saveInterval: number; // Interval for periodic saving
	private readonly SAVE_INTERVAL_MS: number = 10000; // e.g., 10 seconds

	constructor() {
		this.data = {}; // Initialize the in-memory database
		this.loadAllData();
		this.setupPeriodicSave();
		this.setupSaveOnClose();
	}

	// Method to encode data as JSON before saving
	private encode(data: any): string {
		return JSON.stringify(data);
	}

	// Method to decode data back into an object after loading
	private decode(data: string): any {
		return JSON.parse(data);
	}

	// Load all data from localStorage to memory
	private loadAllData(): void {
		for (let i = 0; i < localStorage.length; i++) {
		const key = localStorage.key(i);
		if (key) {
			const value = localStorage.getItem(key);
			if (value) {
			this.data[key] = this.decode(value); // decode from JSON to an object
			}
		}
		}
	}

	// Setup interval to save all data periodically
	private setupPeriodicSave(): void {
		this.saveInterval = window.setInterval(() => {
		this.saveAllData();
		}, this.SAVE_INTERVAL_MS); // specify the interval for periodic saving
	}

	// Save all data from memory to localStorage
	private saveAllData(): void {
		for (const [key, value] of Object.entries(this.data)) {
		localStorage.setItem(key, this.encode(value)); // encode object to JSON
		}
	}

	// Setup saving all data when the window is closed
	private setupSaveOnClose(): void {
		window.addEventListener("beforeunload", (event) => {
		this.saveAllData();
		});
	}

	// Public method to get data by key
	public getData(key: string): any {
		return this.data[key];
	}

	// Public method to set data by key
	public setData(key: string, value: any): void {
		this.data[key] = value;
	}

	public deleteData(key: string): void {
		delete this.data[key];
	}

	public clearData(): void {
		this.data = {};
	}

	// Method to perform a "hard" save, i.e., immediate save
	public hardSave(): void {
		this.saveAllData();
	}
}


//===================
//GETTER
//===================

/**
 * getAccessToken from LocalStorage
 * @returns googleAccessToken
 */
export const getAccessToken = (): string => {
	return window.localStorage.getItem("googleCalendarAccessToken") ?? "";
};

/**
 * getRefreshToken from LocalStorage
 * @returns googleRefreshToken
 */
export const getRefreshToken = (): string => {
	return window.localStorage.getItem("googleCalendarRefreshToken") ?? "";
};

/**
 * getExpirationTime from LocalStorage
 * @returns googleExpirationTime
 */
export const getExpirationTime = (): number => {
	const expirationTimeString =
		window.localStorage.getItem("googleCalendarExpirationTime") ?? "0";
	return parseInt(expirationTimeString, 10);
};


//===================
//SETTER
//===================

/**
 * set AccessToken into LocalStorage
 * @param googleAccessToken googleAccessToken
 * @returns googleAccessToken
 */
export const setAccessToken = (googleAccessToken: string): void => {
	window.localStorage.setItem("googleCalendarAccessToken", googleAccessToken);
};

/**
 * set RefreshToken from LocalStorage
 * @param googleRefreshToken googleRefreshToken
 * @returns googleRefreshToken
 */
export const setRefreshToken = (googleRefreshToken: string): void => {
	if (googleRefreshToken == "undefined") return;
	window.localStorage.setItem("googleCalendarRefreshToken", googleRefreshToken);
};

/**
 * set ExpirationTime from LocalStorage
 * @param googleExpirationTime googleExpirationTime
 * @returns googleExpirationTime
 */
export const setExpirationTime = (googleExpirationTime: number): void => {
	if (isNaN(googleExpirationTime)) return;
	window.localStorage.setItem(
		"googleCalendarExpirationTime",
		googleExpirationTime + ""
	);
};