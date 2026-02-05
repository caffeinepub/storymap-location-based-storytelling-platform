import type { Principal } from "@icp-sdk/core/principal";
export interface Some<T> {
    __kind__: "Some";
    value: T;
}
export interface None {
    __kind__: "None";
}
export type Option<T> = Some<T> | None;
export class ExternalBlob {
    getBytes(): Promise<Uint8Array<ArrayBuffer>>;
    getDirectURL(): string;
    static fromURL(url: string): ExternalBlob;
    static fromBytes(blob: Uint8Array<ArrayBuffer>): ExternalBlob;
    withUploadProgress(onProgress: (percentage: number) => void): ExternalBlob;
}
export interface Location {
    latitude: number;
    longitude: number;
}
export interface Comment {
    id: bigint;
    content: string;
    storyId: string;
    isAnonymous: boolean;
    author: Principal;
    timestamp: bigint;
}
export interface Story {
    id: string;
    title: string;
    likeCount: bigint;
    content: string;
    isAnonymous: boolean;
    author: Principal;
    timestamp: bigint;
    category: Category;
    image?: ExternalBlob;
    location: Location;
    pinCount: bigint;
}
export interface SearchParams {
    keywords?: string;
    category?: Category;
    radius?: number;
    coordinates: Location;
}
export interface Report {
    id: bigint;
    storyId: string;
    timestamp: bigint;
    reporter: Principal;
    reason: string;
}
export interface UserProfile {
    id: Principal;
    seenIntro: boolean;
    pinnedStories: Array<string>;
    username: string;
    storiesPosted: bigint;
    likedStories: Array<string>;
}
export enum Category {
    funny = "funny",
    other = "other",
    love = "love",
    random = "random",
    confession = "confession"
}
export enum UserRole {
    admin = "admin",
    user = "user",
    guest = "guest"
}
export interface backendInterface {
    addComment(storyId: string, content: string, timestamp: bigint, isAnonymous: boolean): Promise<bigint>;
    assignCallerUserRole(user: Principal, role: UserRole): Promise<void>;
    createStory(title: string, content: string, category: Category, location: Location, timestamp: bigint, isAnonymous: boolean, image: ExternalBlob | null): Promise<string>;
    getAllStories(): Promise<Array<Story>>;
    getCallerUserProfile(): Promise<UserProfile | null>;
    getCallerUserRole(): Promise<UserRole>;
    getComments(storyId: string): Promise<Array<Comment>>;
    getRecentStories(amount: bigint): Promise<Array<Story>>;
    getReports(): Promise<Array<Report>>;
    getStoriesByCategory(category: Category): Promise<Array<Story>>;
    getStoryById(id: string): Promise<Story>;
    getUserProfile(user: Principal): Promise<UserProfile | null>;
    hasSeenIntro(): Promise<boolean>;
    isCallerAdmin(): Promise<boolean>;
    likeStory(storyId: string): Promise<void>;
    markIntroSeen(): Promise<void>;
    pinStory(storyId: string): Promise<void>;
    removeReport(reportId: bigint): Promise<void>;
    removeStory(id: string): Promise<void>;
    reportStory(storyId: string, reason: string, timestamp: bigint): Promise<bigint>;
    saveCallerUserProfile(profile: UserProfile): Promise<void>;
    searchStories(params: SearchParams): Promise<Array<Story>>;
    unlikeStory(storyId: string): Promise<void>;
    unpinStory(storyId: string): Promise<void>;
}
