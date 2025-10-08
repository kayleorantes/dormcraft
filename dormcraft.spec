<concept_spec>
concept CollaborationBoard

purpose
    Allow roommates to jointly propose, edit, and comment on room layouts in real time. Serves as the shared workspace where layouts are iterated on.

principle
    The board provides a generic space for collaborative editing. In DormCraft, it is specifically instantiated with room layouts generated using the RoomModel and FurnitureLibrary.

state:
    a set of Boards with
        boardID             String
        users               Set
        layouts             Set
        comments            List<{user: User, text: String, timestamp: Float}>
        
actions:
    addLayout(board: Board, layout: Layout)
        effects: stores a new proposed layout in the board

    comment(board: Board, user: User, text: String)
        effects: attaches a comment to the board

    shareLink(board: Board): (url: String)
        effects: generates a shareable link for collaborators

</concept_spec>


<concept_spec>
concept AIAugmentedCollaborationBoard

purpose
    Allow roommates to jointly propose, edit, and comment on room layouts in real time. Additionally, leverage AI to analyze proposals and suggestions to automatically generate compromise or optimized layouts.
    
principle
    The board is the shared workspace. The AI feature is a non-user participant that can synthesize existing user proposals and textual comments to produce a new, potentially superior layout, fostering agreement. The AI-generated layout is a new proposal and requires user review.
    
state:
    a set of Boards with
        boardID             String
        users               Set
        layouts             Set
        comments            List<{user: User, text: String, timestamp: Float}>
        roomModelID         String
        
actions:
    addLayout(board: Board, layout: Layout)
        effects: stores a new proposed layout in the board

    comment(board: Board, user: User, text: String)
        effects: attaches a comment to the board

    shareLink(board: Board): (url: String)
        effects: generates a shareable link for collaborators

    suggestLayout(board: Board): (newLayout: Layout) 
        effects: Calls an LLM with the room model data, all proposed layouts, and all comments. The LLM generates a new, optimized layout based on the input. This new layout is then stored in the board and tagged as AI-generated.

</concept_spec>