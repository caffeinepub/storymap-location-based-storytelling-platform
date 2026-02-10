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
export interface ProximityQuery {
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
    viewCount: bigint;
    timestamp: bigint;
    category: Category;
    image?: ExternalBlob;
    location: Location;
    pinCount: bigint;
}
export interface LocalUpdatePublic {
    id: bigint;
    latitude: number;
    content: string;
    author: Principal;
    longitude: number;
    thumbsUp: bigint;
    timestamp: bigint;
    category: LocalCategory;
    radius: bigint;
    image?: ExternalBlob;
}
export interface Report {
    id: bigint;
    storyId: string;
    timestamp: bigint;
    reporter: Principal;
    reason: string;
}
export interface SearchParams {
    sort: SortOption;
    keywords?: string;
    category?: Category;
    radius?: number;
    coordinates: Location;
}
export interface StoryDraft {
    id: string;
    title: string;
    content: string;
    createdAt: bigint;
    isAnonymous: boolean;
    author: Principal;
    updatedAt: bigint;
    timestamp: bigint;
    category: Category;
    image?: ExternalBlob;
    location?: Location;
}
export interface StoryView {
    id: string;
    title: string;
    likeCount: bigint;
    content: string;
    isAnonymous: boolean;
    author: Principal;
    viewCount: bigint;
    viewers: Array<Principal>;
    timestamp: bigint;
    category: Category;
    image?: ExternalBlob;
    location: Location;
    pinCount: bigint;
}
export type SortOption = {
    __kind__: "nearest";
    nearest: {
        location: Location;
    };
} | {
    __kind__: "newest";
    newest: null;
} | {
    __kind__: "mostPinned";
    mostPinned: null;
} | {
    __kind__: "mostLiked";
    mostLiked: null;
} | {
    __kind__: "mostViewed";
    mostViewed: null;
};
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
export enum LocalCategory {
    nature = "nature",
    event = "event",
    traffic = "traffic",
    general = "general",
    power = "power",
    police = "police"
}
export enum UserRole {
    admin = "admin",
    user = "user",
    guest = "guest"
}
export interface backendInterface {
    addComment(storyId: string, content: string, timestamp: bigint, isAnonymous: boolean): Promise<bigint>;
    addLocalUpdate(content: string, latitude: number, longitude: number, radius: bigint, category: LocalCategory, image: ExternalBlob | null): Promise<bigint>;
    assignCallerUserRole(user: Principal, role: UserRole): Promise<void>;
    createDraft(title: string, content: string, category: Category, location: Location | null, isAnonymous: boolean, image: ExternalBlob | null): Promise<string>;
    createStory(title: string, content: string, category: Category, location: Location, timestamp: bigint, isAnonymous: boolean, image: ExternalBlob | null): Promise<string>;
    deleteDraft(draftId: string): Promise<void>;
    getActiveLocalUpdatesByProximity(location: Location): Promise<Array<LocalUpdatePublic>>;
    getAllActiveLocalUpdates(): Promise<Array<LocalUpdatePublic>>;
    getAllStories(): Promise<Array<Story>>;
    getCallerUserProfile(): Promise<UserProfile | null>;
    getCallerUserRole(): Promise<UserRole>;
    getComments(storyId: string): Promise<Array<Comment>>;
    getDraft(draftId: string): Promise<StoryDraft | null>;
    getLikedStoriesByUser(user: Principal): Promise<Array<StoryView>>;
    getLocalUpdateById(id: bigint): Promise<LocalUpdatePublic>;
    getLocalUpdatesByCategory(category: LocalCategory): Promise<Array<LocalUpdatePublic>>;
    getPinnedStoriesByUser(user: Principal): Promise<Array<StoryView>>;
    getReports(): Promise<Array<Report>>;
    getStoriesByCategory(category: Category, sortOption: SortOption): Promise<Array<Story>>;
    getStoriesByUser(author: Principal): Promise<Array<StoryView>>;
    getStoryById(id: string): Promise<Story>;
    getUserProfile(user: Principal): Promise<UserProfile | null>;
    hasSeenIntro(): Promise<boolean>;
    incrementStoryViewCount(id: string): Promise<void>;
    isCallerAdmin(): Promise<boolean>;
    likeStory(storyId: string): Promise<void>;
    listDrafts(): Promise<Array<StoryDraft>>;
    markIntroSeen(): Promise<void>;
    pinStory(storyId: string): Promise<void>;
    publishDraft(draftId: string): Promise<string>;
    queryByProximity(proximityQuery: ProximityQuery): Promise<Array<LocalUpdatePublic>>;
    removeLocalUpdate(id: bigint): Promise<void>;
    removeReport(reportId: bigint): Promise<void>;
    removeStory(id: string): Promise<void>;
    reportStory(storyId: string, reason: string, timestamp: bigint): Promise<bigint>;
    saveCallerUserProfile(profile: UserProfile): Promise<void>;
    searchStories(params: SearchParams): Promise<Array<Story>>;
    thumbsUpLocalUpdate(updateId: bigint): Promise<void>;
    unlikeStory(storyId: string): Promise<void>;
    unpinStory(storyId: string): Promise<void>;
    updateDraft(draftId: string, title: string, content: string, category: Category, location: Location | null, isAnonymous: boolean, image: ExternalBlob | null): Promise<void>;
    updateStory(storyId: string, title: string, content: string, category: Category, location: Location, isAnonymous: boolean, image: ExternalBlob | null): Promise<void>;
}
