import { GeminiLLM } from './gemini-llm'; //VERIFY PATH


export interface User { name: string; }

export interface Furniture {
    id: string;
    name: string;
    width: number; // in feet
    depth: number; // in feet
    isMovable: boolean;
}

export interface FurniturePlacement {
    furnitureId: string;
    x: number; // Bottom-left corner X
    y: number; // Bottom-left corner Y
    rotation: number; // Degrees
}

export interface Layout {
    layoutId: string;
    placements: FurniturePlacement[];
    creator: string; // User name or "DormCraft AI"
}

export interface Comment {
    user: User;
    text: string;
    timestamp: number;
}

export interface RoomModel {
    id: string;
    width: number;
    depth: number;
    requiredFurniture: { [furnitureId: string]: number };
    noGoZones: { id: string, xMin: number, yMin: number, xMax: number, yMax: number }[]; // Critical areas
}

export interface LLMOutput {
    placements: FurniturePlacement[];
    rationale: string;
}


// --- Layout Validator Class ---

/**
 * Enforces geometric and resource constraints on layouts, catching LLM errors.
 */
export class LayoutValidator {
    private roomModel: RoomModel;
    private furnitureLibrary: { [id: string]: Furniture };

    constructor(roomModel: RoomModel, furnitureLibrary: { [id: string]: Furniture }) {
        this.roomModel = roomModel;
        this.furnitureLibrary = furnitureLibrary;
    }

    // Validator 1: Checks for overlap with non-negotiable areas (e.g., door swing)
    public checkFixedFeatureOverlap(layout: Layout): void {
        for (const placement of layout.placements) {
            const furniture = this.furnitureLibrary[placement.furnitureId];
            const fxMin = placement.x, fyMin = placement.y;
            const fxMax = placement.x + furniture.width, fyMax = placement.y + furniture.depth;

            for (const zone of this.roomModel.noGoZones) {
                // AABB overlap check
                const overlap = (
                    fxMax > zone.xMin && fxMin < zone.xMax &&
                    fyMax > zone.yMin && fyMin < zone.yMax
                );
                
                if (overlap) {
                    throw new Error(`[Validator 1] Furniture '${furniture.name}' placed in fixed feature zone '${zone.id}'.`);
                }
            }
        }
    }

    // Validator 2: Checks for furniture overlap and placement outside room boundaries
    public checkPhysicalOverlapAndBounds(layout: Layout): void {
        const roomWidth = this.roomModel.width;
        const roomDepth = this.roomModel.depth;

        for (let i = 0; i < layout.placements.length; i++) {
            const p1 = layout.placements[i];
            const f1 = this.furnitureLibrary[p1.furnitureId];
            const f1xMax = p1.x + f1.width, f1yMax = p1.y + f1.depth;

            // Boundary Check
            if (p1.x < 0 || p1.y < 0 || f1xMax > roomWidth || f1yMax > roomDepth) {
                throw new Error(`[Validator 2] Furniture '${f1.name}' is placed outside room boundaries.`);
            }

            // Overlap Check (pairwise comparison)
            for (let j = i + 1; j < layout.placements.length; j++) {
                const p2 = layout.placements[j];
                const f2 = this.furnitureLibrary[p2.furnitureId];

                const f2xMin = p2.x, f2yMin = p2.y;
                const f2xMax = p2.x + f2.width, f2yMax = p2.y + f2.depth;
                
                const overlap = (f1xMax > f2xMin && p1.x < f2xMax && f1yMax > f2yMin && p1.y < f2yMax);
                
                if (overlap) {
                    throw new Error(`[Validator 2] Furniture '${f1.name}' overlaps with '${f2.name}'.`);
                }
            }
        }
    }

    // Validator 3: Checks against the required furniture list (no hallucination)
    public checkFurnitureInventory(layout: Layout): void {
        const placedCounts: { [id: string]: number } = {};
        for (const placement of layout.placements) {
            placedCounts[placement.furnitureId] = (placedCounts[placement.furnitureId] || 0) + 1;
        }

        // Check 1: No hallucination (no unrequested IDs)
        for (const itemId in placedCounts) {
            if (!(itemId in this.roomModel.requiredFurniture)) {
                 throw new Error(`[Validator 3] Layout contains unrequested furniture ID: ${itemId}.`);
            }
        }
        
        // Check 2: Correct count (no missing or extra items)
        for (const itemId in this.roomModel.requiredFurniture) {
            const requiredCount = this.roomModel.requiredFurniture[itemId];
            const foundCount = placedCounts[itemId] || 0;
            if (foundCount !== requiredCount) {
                 throw new Error(`[Validator 3] Layout must contain exactly ${requiredCount} of item ${itemId}, but found ${foundCount}.`);
            }
        }
    }

    /** Runs all three validators against a proposed layout. */
    public validateLayout(layout: Layout): boolean {
        this.checkFixedFeatureOverlap(layout);
        this.checkPhysicalOverlapAndBounds(layout);
        this.checkFurnitureInventory(layout);
        return true;
    }
}


// --- AI-Augmented Collaboration Board Concept ---

export class AIAugmentedCollaborationBoard {
    public readonly boardId: string;
    public readonly roomModelID: string;
    public users: Set<User> = new Set();
    public layouts: { [id: string]: Layout } = {};
    public comments: Comment[] = [];
    
    private roomModel: RoomModel;
    private furnitureLibrary: { [id: string]: Furniture };
    private validator: LayoutValidator;
    private llmClient: GeminiLLM; // Integrated Client
    private layoutCounter: number = 0;

    constructor(
        boardId: string, 
        roomModel: RoomModel, 
        furnitureLibrary: { [id: string]: Furniture },
        llmApiKey: string
    ) {
        this.boardId = boardId;
        this.roomModel = roomModel;
        this.roomModelID = roomModel.id;
        this.furnitureLibrary = furnitureLibrary;
        this.validator = new LayoutValidator(roomModel, furnitureLibrary);
        this.llmClient = new GeminiLLM({ apiKey: llmApiKey }); // Initialize client
    }

    public addLayout(layout: Layout): void {
        try {
            this.validator.validateLayout(layout);
            this.layoutCounter++;
            layout.layoutId = `L${this.layoutCounter}`;
            this.layouts[layout.layoutId] = layout;
            console.log(`✅ Layout ${layout.layoutId} (${layout.creator}) added successfully.`);
        } catch (e: any) {
            console.log(`Failed to add layout: ${e.message}`);
        }
    }

    public comment(user: User, text: string): void {
        this.comments.push({ user, text, timestamp: Date.now() });
        console.log(`💬 ${user.name} commented: '${text}'`);
    }

    public shareLink(): string {
        return `https://dormcraft.mit.edu/board/${this.boardId}`;
    }

    /**
     * AI-Augmented Action: Calls the LLM to generate an optimized compromise layout.
     */
    public async suggestLayout(): Promise<Layout | null> {
        if (Object.keys(this.layouts).length === 0) {
            console.log("⚠️ Cannot suggest a layout without any user proposals.");
            return null;
        }

        // 1. Prepare Context (Prompt Generation)
        const layoutData = JSON.stringify(Object.values(this.layouts));
        const commentData = this.comments.map(c => `${c.user.name}: ${c.text}`).join('\n');
        const furnitureList = Object.values(this.furnitureLibrary)
            .map(f => `${f.name} (${f.id}): ${f.width}x${f.depth}ft`);
        
        const prompt = this.createLayoutPrompt(layoutData, commentData, furnitureList);
        
        try {
            // 2. Call LLM Client
            console.log('\n🤖 Requesting AI Layout Suggestion from Gemini...');
            const llmResponseJson: string = await this.llmClient.executeLLM(prompt);
            
            // 3. Parse and Validate
            const jsonMatch = llmResponseJson.match(/\{[\s\S]*\}/);
            if (!jsonMatch) { throw new Error('Gemini response did not contain a valid JSON object.'); }

            const llmOutput: LLMOutput = JSON.parse(jsonMatch[0]);
            
            const aiLayout: Layout = {
                layoutId: "TEMP_AI", 
                placements: llmOutput.placements,
                creator: "DormCraft AI",
            };
            
            // Validation step is crucial after LLM output
            this.validator.validateLayout(aiLayout);
            
            // 4. Store Valid Layout
            this.addLayout(aiLayout);
            console.log(`✨ AI Layout L${this.layoutCounter} added (Rationale: ${llmOutput.rationale}).`);
            return aiLayout;

        } catch (e: any) {
            console.log(`AI suggestion failed due to API or validation error: ${e.message}`);
            return null;
        }
    }

    // Helper to construct the detailed prompt for the LLM
    private createLayoutPrompt(layoutData: string, commentData: string, furnitureList: string[]): string {
        return `
You are an **AI Layout Optimizer** for MIT DormCraft. Your goal is to analyze user proposals and comments to generate a single, new compromise layout that is physically sound and resolves conflicts.

**ROOM CONTEXT**:
- Room ID: ${this.roomModelID}, Dimensions: ${this.roomModel.width}x${this.roomModel.depth}ft.
- **CRITICAL NO-GO ZONES** (Must be avoided by ALL furniture): ${JSON.stringify(this.roomModel.noGoZones)}
- **AVAILABLE FURNITURE** (Must use all of these, no more, no less): ${furnitureList.join(', ')}

**USER CONFLICTS & PRIORITIES**:
${commentData}

**PROPOSED LAYOUTS (User Input)**:
${layoutData}

**CRITICAL REQUIREMENTS (The output must pass all of these)**:
1. Generate a single layout object containing ALL required furniture.
2. The coordinates must be physically sound (no overlap, no placement outside room boundaries).
3. The layout MUST attempt to synthesize the conflicting priorities stated in the comments.
4. If a user states a veto (e.g., "I hate bunk beds"), avoid that solution.

Return your response as a single JSON object with this exact structure (NO extra text):
{
  "placements": [
    { "furnitureId": "exact_id_from_list", "x": 0.5, "y": 8.0, "rotation": 0 },
    // ... all other placements
  ],
  "rationale": "A brief explanation of how this layout resolves the user conflict."
}
`;
    }
}
