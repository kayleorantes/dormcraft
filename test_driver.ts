import { 
    User, Furniture, RoomModel, FurniturePlacement, 
    Layout, AIAugmentedCollaborationBoard
} from './dormcraft_concept'; 

// --- 1. Setup Environment ---
const DUMMY_API_KEY = process.env.GEMINI_API_KEY; // Use environment variable, VERIFY THIS

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
        { id: "window_wall", xMin: 0.0, yMin: 14.5, xMax: 12.0, yMax: 15.0} 
    ]
};

const board = new AIAugmentedCollaborationBoard(
    "DORM_EC_301",
    ROOM_MODEL_EAST_CAMPUS,
    FURNITURE_LIBRARY,
    DUMMY_API_KEY
);
board.users.add(userSelena);
board.users.add(userAlex);

// Main execution function
async function runTests() {
    console.log("--- INITIAL SETUP COMPLETE ---");
    console.log(`Collaboration Board for ${board.roomModelID} created.`);
    console.log("------------------------------\n");

    // --- TEST SCENARIO 1: WINDOW ACCESS CONFLICT (Successful AI Suggestion) ---
    console.log("--- TEST SCENARIO 1: WINDOW ACCESS CONFLICT ---");

    // Conflicting layouts (omitted detailed placement array for brevity, assumed valid)
    const layoutSelena: Layout = { layoutId: "L_S", placements: [], creator: userSelena.name };
    const layoutAlex: Layout = { layoutId: "L_A", placements: [], creator: userAlex.name };

    // Fill placements with mock data for valid entry
    layoutSelena.placements = [
        { furnitureId: "bed_twin_xl", x: 0.5, y: 0.5, rotation: 0 }, { furnitureId: "bed_twin_xl", x: 7.5, y: 0.5, rotation: 0 },
        { furnitureId: "desk_mit", x: 2.0, y: 11.0, rotation: 0 }, { furnitureId: "desk_mit", x: 8.0, y: 1.0, rotation: 0 },
        { furnitureId: "dresser_mit", x: 4.0, y: 5.0, rotation: 0 }, { furnitureId: "dresser_mit", x: 6.0, y: 5.0, rotation: 0 },
    ];
    layoutAlex.placements = [
        { furnitureId: "bed_twin_xl", x: 0.5, y: 0.5, rotation: 0 }, { furnitureId: "bed_twin_xl", x: 7.5, y: 0.5, rotation: 0 },
        { furnitureId: "desk_mit", x: 8.0, y: 11.0, rotation: 0 }, { furnitureId: "desk_mit", x: 2.0, y: 1.0, rotation: 0 },
        { furnitureId: "dresser_mit", x: 4.0, y: 5.0, rotation: 0 }, { furnitureId: "dresser_mit", x: 6.0, y: 5.0, rotation: 0 },
    ];
    
    board.addLayout(layoutSelena);
    board.addLayout(layoutAlex);

    board.comment(userSelena, "I need my desk by the window for my plants and sun for studying.");
    board.comment(userAlex, "I want my desk by the sun because that's how I work best!");

    // Execute AI-Augmented Action (Async call)
    console.log("\n[USER ACTION] Awaiting suggestLayout to resolve conflict...");
    const aiLayout = await board.suggestLayout();

    if (aiLayout) {
        console.log(`\n--- RESULT 1 ---`);
        console.log(`AI compromise layout successfully added: ${aiLayout.layoutId}`);
        console.log(`Total Layouts on Board: ${Object.keys(board.layouts).length}`);
    }

    // --- TEST SCENARIO 2: VALIDATOR FAILURE (Door Block) ---
    console.log("\n--- TEST SCENARIO 2: VALIDATOR FAILURE (Door Block) ---");

    // Bad Layout: Blocks the door swing arc (no-go zone x_max=3, y_max=3)
    const badPlacements = [
        { furnitureId: "bed_twin_xl", x: 0.5, y: 0.5, rotation: 0 },
        { furnitureId: "bed_twin_xl", x: 7.5, y: 8.0, rotation: 0 },
        { furnitureId: "desk_mit", x: 1.5, y: 1.5, rotation: 0 }, // <-- BAD: Inside door swing
        { furnitureId: "desk_mit", x: 8.0, y: 1.0, rotation: 0 },
        { furnitureId: "dresser_mit", x: 4.0, y: 5.0, rotation: 0 },
        { furnitureId: "dresser_mit", x: 6.0, y: 5.0, rotation: 0 },
    ];
    const badLayout: Layout = { layoutId: "L_BAD", placements: badPlacements, creator: userSelena.name };

    // Attempt to add the bad layout - should fail Validator 1
    console.log("\n[USER ACTION] Attempting to add a layout that blocks the door...");
    board.addLayout(badLayout); 

    // --- TEST SCENARIO 3: VALIDATOR FAILURE (Hallucination) ---
    console.log("\n--- TEST SCENARIO 3: VALIDATOR FAILURE (Hallucination) ---");

    // Hallucinated Layout: Missing required furniture (only 1 bed, needs 2)
    const hallucinationPlacements = [
        { furnitureId: "bed_twin_xl", x: 0.5, y: 0.5, rotation: 0 }, // Missing one bed
        { furnitureId: "desk_mit", x: 8.0, y: 1.0, rotation: 0 },
        { furnitureId: "desk_mit", x: 2.0, y: 1.0, rotation: 0 },
        { furnitureId: "dresser_mit", x: 4.0, y: 5.0, rotation: 0 },
        { furnitureId: "dresser_mit", x: 6.0, y: 5.0, rotation: 0 },
    ];
    const hallucinationLayout: Layout = { layoutId: "L_HALL", placements: hallucinationPlacements, creator: userSelena.name };

    // Attempt to add the hallucinated layout - should fail Validator 3
    console.log("\n[USER ACTION] Attempting to add a layout with a missing required item...");
    board.addLayout(hallucinationLayout);
}

runTests();
