import dotenv from "dotenv"
import { Router } from "express";
import { ChatMistralAI } from "@langchain/mistralai";

dotenv.config()

const router = Router()



import { z } from "zod";
import { Annotation, StateGraph } from "@langchain/langgraph";

const structure = z.object({
    feedback: z.string().describe("Detailed feedbackfor the essay"),
    score: z.string().describe("Score out of 10', ge=0, le=10"),
});



const UPSCState = Annotation.Root({
    essay: Annotation<string>,
    language_feedback: Annotation<string>,
    analysis_feedback: Annotation<string>,
    clarity_feedback: Annotation<string>,
    overall_feedback: Annotation<string>,
    individual_scores: Annotation<number[]>({
        value: (state, update) => (state ?? []).concat(update),
        default: () => []
    }),
    avg_score: Annotation<number>,

});

const model = new ChatMistralAI({
    model: "mistral-large-latest",
    temperature: 0,

});
const structuredLlm = model.withStructuredOutput(structure);


const evaluate_language = async (state: typeof UPSCState.State) => {
    const prompt = `Evaluate the language quality of the following essay and provide a feedback and assign a score out of 10 \n ${state.essay}`
    const output = await structuredLlm.invoke(prompt)

    return { 'language_feedback': output.feedback, 'individual_scores': Number(output.score) }

}
const evaluate_analysis = async (state: typeof UPSCState.State) => {
    const prompt = `Evaluate the depth of analysis of the following essay and provide a feedback and assign a score out of 10  \n ${state.essay}`
    const output = await structuredLlm.invoke(prompt)

    return { 'analysis_feedback': output.feedback, 'individual_scores': Number(output.score) }

}

const evaluate_thought = async (state: typeof UPSCState.State) => {
    const prompt = `Evaluate the clarity of thought of the following essay and provide a feedback and assign a score out of 10  \n ${state.essay}`
    const output = await structuredLlm.invoke(prompt)

    return { 'clarity_feedback': output.feedback, 'individual_scores': Number(output.score) }

}
const final_evaluation = async (state: typeof UPSCState.State) => {
    const prompt = `Based on the following feedbacks create a summarized feedback \n language feedback - ${state["language_feedback"]} \n depth of analysis feedback - ${state["analysis_feedback"]} \n clarity of thought feedback - ${state.clarity_feedback}`
    const overall_feedback = (await model.invoke(prompt)).content
    const scores = state.individual_scores || [];
    const avg_score = scores.length > 0
        ? scores.reduce((a, b) => a + b, 0) / scores.length
        : 0;
    return { 'overall_feedback': overall_feedback, 'avg_score': avg_score }


}



router.post("/", async (req, res) => {
    const { essay } = req.body
    if (!essay) {
        return res.status(500).json({ message: "essay not found" })
    }
    const graph = new StateGraph(UPSCState)
        .addNode('evaluate_language', evaluate_language)
        .addNode('evaluate_analysis', evaluate_analysis)
        .addNode('evaluate_thought', evaluate_thought)
        .addNode('final_evaluation', final_evaluation)

        .addEdge('__start__', "evaluate_language")
        .addEdge('__start__', 'evaluate_analysis')
        .addEdge('__start__', 'evaluate_thought')

        .addEdge('evaluate_language', "final_evaluation")
        .addEdge('evaluate_analysis', 'final_evaluation')
        .addEdge('evaluate_thought', 'final_evaluation')

        .addEdge("final_evaluation", "__end__")

    const app = graph.compile();
    // const mermaidCode = app.getGraph().drawMermaid();

    // console.log(mermaidCode);
    const data = await app.invoke({ essay: essay });
    res.json(data)
})


export const essayRoutes = router