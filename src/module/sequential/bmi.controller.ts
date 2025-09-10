import { Router } from "express";
import { StateGraph, Annotation } from "@langchain/langgraph";

const router = Router();

// Graph state
const StateAnnotation = Annotation.Root({
    height: Annotation<number>,
    weight: Annotation<number>,
    bmi: Annotation<number>
});

//graph node
async function calculateBmi(state: typeof StateAnnotation.State) {
    const result = state.weight / (state.height * state.height);
    return { bmi: result };
}


router.post("/", async (req, res) => {
    const { height, weight } = req.body
    if(!height || !weight){
        return res.status(500).json({message:"not probide height or weight"})
    }
    const chain = new StateGraph(StateAnnotation)
        .addNode("calculateBmi", calculateBmi)
        .addEdge("__start__", "calculateBmi")
        .addEdge("calculateBmi", "__end__")
        .compile()
    // const mermaidCode = chain.getGraph().drawMermaid();

    // console.log(mermaidCode);
    const state = await chain.invoke({ weight, height });
    res.json(state)

});

export const bmiRoutes = router;
