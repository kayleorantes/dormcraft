import { 
    User, Furniture, RoomModel, FurniturePlacement, 
    Layout, AIAugmentedCollaborationBoard
} from './dormcraft'; 

import { GeminiLLM, Config } from './gemini-llm'; // Import the Config interface
import * as path from 'path';
import * as fs from 'fs';


// --- Configuration Loading Function ---
/**
 * Loads the API key configuration from config.json.
 */
function loadConfig(): Config {
    // Resolve path to config.json in the project root, not the dist/ folder
    const configPath = path.resolve(__dirname, '../config.json');
    try {
        const configFile = fs.readFileSync(configPath, 'utf-8');
        const config = JSON.parse(configFile);
        if (!config.apiKey) {
             throw new Error("config.json found but 'apiKey' is missing.");
        }
        return config as Config;
    } catch (error) {
        console.error('❌ Error loading config.json. Please ensure it exists and is correctly structured.');
        throw new Error('Configuration file error. Please verify the path and file existence.');
    }
}
// --- End Configuration Function ---


// --- 1. Setup Environment Variables ---
const config = loadConfig();
const API_KEY = config.apiKey; 

const userSelena: User = { name: "Selena" };
const userAlex: User = { name: "Alex" };

const FURNITURE_LIBRARY: { [id: string]: Furniture } = {
    "bed_twin_xl": { id: "bed_twin_xl", name: "Bed (Twin XL)", width: 3.25, depth: 6.67, isMovable: true },
    "desk_mit": { id: "desk_mit", name: "MIT Desk", width: 2.0, depth: 4.0, isMovable: true },
    "dresser_mit": { id: "dresser_mit", name: "Dresser (3-Drawer)", width: 2.0, depth: 2.5, isMovable: true },
};

const ROOM_MODEL_EAST_CAMPUS: RoomModel = {
    id: "EC_Dbl_12x15",
    width: 12.0,
    depth: 15.0,
    requiredFurniture: {
        "bed_twin_xl": 2,
        "desk_mit": 2,
        "dresser_mit": 2,
    },
    // No-Go Zone: Door swing arc from (0,0) corner, 3ft wide/deep
    noGoZones: [
        { id: "door_swing", xMin: 0.0, yMin: 0.0, xMax: 3.0, yMax: 3.0 },
        // No-Go Zone: Last 0.5ft of the room for baseboards/radiator (y > 14.5)
        { id: "window_wall", xMin: 0.0, yMin: 14.5, xMax: 12.0, yMax: 15.0} 
    ]
};

// --- VALID BASE PLACEMENTS (GUARANTEED SAFE AND NON-OVERLAPPING) ---
const VALID_FIXED_BASE_PLACEMENTS: FurniturePlacement[] = [
    // Bed 1: X=3.5 (safe from door swing)
    { furnitureId: "bed_twin_xl", x: 3.5, y: 0.5, rotation: 0 }, 
    // Bed 2: X=8.0 (safe from Bed 1)
    { furnitureId: "bed_twin_xl", x: 8.0, y: 0.5, rotation: 0 }, 
    
    // Dresser 1: X=0.5, Y=3.5 (SAFE from door swing because Y > 3.0)
    { furnitureId: "dresser_mit", x: 0.5, y: 3.5, rotation: 0 }, 
    // Dresser 2: X=3.5, Y=8.0 (safe)
    { furnitureId: "dresser_mit", x: 3.5, y: 8.0, rotation: 0 },
];

// --- Initialization Function ---
function initializeBoard(): AIAugmentedCollaborationBoard {
    const board = new AIAugmentedCollaborationBoard(
        "DORM_EC_301",
        ROOM_MODEL_EAST_CAMPUS,
        FURNITURE_LIBRARY,
        API_KEY
    );
    board.users.add(userSelena);
    board.users.add(userAlex);
    return board;
}


// --- Test Case 1: Successful AI Resolution ---

export async function testAISuggestion(): Promise<void> {
    const board = initializeBoard();
    
    console.log('\n🧪 TEST CASE 1: AI-Assisted Conflict Resolution');
    console.log('==============================================');

    // Clean start (layouts are reset in initializeBoard)
    
    const layoutSelena: Layout = { layoutId: "L_S", placements: [], creator: userSelena.name };
    const layoutAlex: Layout = { layoutId: "L_A", placements: [], creator: userAlex.name };

    // Layout Selena: Conflicting Proposal 1
    layoutSelena.placements = [
        ...VALID_FIXED_BASE_PLACEMENTS,
        { furnitureId: "desk_mit", x: 0.5, y: 10.5, rotation: 0 },  // Desk 1 near window
        { furnitureId: "desk_mit", x: 9.5, y: 10.5, rotation: 0 },   // Desk 2 away
    ];
    // Layout Alex: Conflicting Proposal 2
    layoutAlex.placements = [
        ...VALID_FIXED_BASE_PLACEMENTS,
        { furnitureId: "desk_mit", x: 0.5, y: 10.5, rotation: 0 },  // Desk 2 near window
        { furnitureId: "desk_mit", x: 9.5, y: 10.5, rotation: 0 },   // Desk 1 away
    ];
    
    board.addLayout(layoutSelena);
    board.addLayout(layoutAlex);

    board.comment(userSelena, "I need my desk by the window for my plants and sun for studying.");
    board.comment(userAlex, "I want my desk by the sun because that's how I work best!");

    console.log("\n[USER ACTION] Awaiting suggestLayout to resolve conflict...");
    const aiLayout = await board.suggestLayout();

    if (aiLayout) {
        console.log(`\n--- RESULT 1 ---`);
        console.log(`AI compromise layout successfully added: ${aiLayout.layoutId}`);
        console.log(`Total Layouts on Board: ${Object.keys(board.layouts).length}`);
    }
}

// --- Test Case 2: Validator 1 Failure (Door Block) ---

export async function testValidator1Failure(): Promise<void> {
    const board = initializeBoard();
    
    console.log('\n🧪 TEST CASE 2: Validation Failure - Door Block (V1)');
    console.log('=====================================================');
    
    // Start with a valid base set of 4 items
    const baseSetV1 = VALID_FIXED_BASE_PLACEMENTS.slice();

    // INTENDED FAILURE: Place a desk in the door swing (1.5, 1.5)
    baseSetV1.push({ furnitureId: "desk_mit", x: 1.5, y: 1.5, rotation: 0 }); 
    // Add the second desk in a SAFE place to satisfy inventory
    baseSetV1.push({ furnitureId: "desk_mit", x: 9.5, y: 10.0, rotation: 0 });
    
    const badLayoutV1: Layout = { layoutId: "L_BAD_V1", placements: baseSetV1, creator: userSelena.name };

    console.log("[USER ACTION] Attempting to add a layout that blocks the door...");
    board.addLayout(badLayoutV1); // EXPECTED: Fail V1
}

// --- Test Case 3: Validator 3 Failure (Missing Item/Hallucination) ---

export async function testValidator3Failure(): Promise<void> {
    const board = initializeBoard();
    
    console.log('\n🧪 TEST CASE 3: Validation Failure - Missing Item (V3)');
    console.log('========================================================');

    // Hallucinated Layout: Missing required furniture (only 1 bed, needs 2)
    const hallucinationPlacements: FurniturePlacement[] = [
        // Only ONE Bed: (Should be 2 - THIS IS THE INTENDED FAILURE)
        { furnitureId: "bed_twin_xl", x: 3.5, y: 0.5, rotation: 0 }, 
        
        // Two Desks and Two Dressers (to satisfy the count for everything else)
        { furnitureId: "desk_mit", x: 9.5, y: 10.5, rotation: 0 },
        { furnitureId: "desk_mit", x: 0.5, y: 10.5, rotation: 0 },
        { furnitureId: "dresser_mit", x: 0.5, y: 3.5, rotation: 0 },
        { furnitureId: "dresser_mit", x: 3.5, y: 8.0, rotation: 0 },
    ];
    const hallucinationLayout: Layout = { layoutId: "L_HALL", placements: hallucinationPlacements, creator: userSelena.name };

    console.log("[USER ACTION] Attempting to add a layout with a missing required item...");
    board.addLayout(hallucinationLayout); // EXPECTED: Fail V3
}


// --- Main Execution ---

async function main(): Promise<void> {
    console.log('🎓 DormCraft AI Augmentation Test Suite');
    console.log('======================================\n');
    
    console.log("--- Initializing Test Suite ---");
    console.log(`Gemini API Key Status: ${API_KEY.length > 20 ? 'Active' : 'DUMMY/MOCKED (using internal logic)'}`);
    console.log("------------------------------");

    try {
        // Run test cases sequentially
        await testAISuggestion();
        await testValidator1Failure();
        await testValidator3Failure();
        
        console.log('\n🎉 All test cases completed successfully!');
        
    } catch (error) {
        console.error('❌ Test execution failed:', (error as Error).message);
        process.exit(1);
    }
}

// Run the tests if this file is executed directly
if (require.main === module) {
    main();
}