import dotenv from "dotenv"
import { response, Router } from "express";
import { ChatMistralAI } from "@langchain/mistralai";
import { z } from "zod";
import { Annotation, StateGraph } from "@langchain/langgraph";
dotenv.config()

const router = Router()





const structure = z.object({
    sentiment: z.enum(["positive", "negative"]).describe("Sentiment of the review"),
});

const DiagnosisStructure = z.object({
    issue_type: z.enum(["UX", "Performance", "Bug", "Support", "Other"])
        .describe("The category of issue mentioned in the review"),
    tone: z.enum(["angry", "frustrated", "disappointed", "calm"])
        .describe("The emotional tone expressed by the user"),
    urgency: z.enum(["low", "medium", "high"])
        .describe("How urgent or critical the issue appears to be"),
});

const model = new ChatMistralAI({
    model: "mistral-large-latest",
    temperature: 0,

});

const structured_model = model.withStructuredOutput(structure)
const structured_model2 = model.withStructuredOutput(DiagnosisStructure)

const reviewState = Annotation.Root({
    review: Annotation<string>(),
    sentiment: Annotation<"positive" | "negative">(), // union type for sentiment
    diagnosis: Annotation<z.infer<typeof DiagnosisStructure>>(), // structured object
    response: Annotation<string>(),
});

const find_sentiment = async (state: typeof reviewState.State) => {
    const prompt = `For the following review find out the sentiment \n ${state["review"]}`
    const sentiment = (await structured_model.invoke(prompt)).sentiment
    return { 'sentiment': sentiment }
}

const check_sentiment = async (state: typeof reviewState.State) => {
    if (state.sentiment == "positive") {
        return "positive_response"
    } else {
        return "run_diagnosis"
    }
}

const positive_response = async (state: typeof reviewState.State) => {
    const prompt = `Write a warm thank-you message in response to this review:
    \n\n\"${state['review']}\"\n
Also, kindly ask the user to leave feedback on our website.`
    const response = (await model.invoke(prompt)).content

    return { "response": response }

}
const run_diagnosis = async (state: typeof reviewState.State) => {
    const diagnosis = await structured_model2.invoke(
        `Diagnose this negative review:\n\n ${state['review']}
Return issue_type, tone, and urgency`
    );

    return { diagnosis }; 
};


const negative_response = async (state: typeof reviewState.State) => {
    const diagnosis = state['diagnosis']
    const prompt = `
    You are a support assistant.
The user had a '${diagnosis.issue_type}' issue, sounded '${diagnosis.tone}', and marked urgency as '${diagnosis['urgency']}'.
Write an empathetic, helpful resolution message.
    `
    const response = (await model.invoke(prompt)).content
    return { 'response': response }
}
router.post("/", async (req, res) => {
    const { review } = req.body
    if (!review) {
        return res.status(500).json({ message: "review not found" })
    }
    const graph = new StateGraph(reviewState)
        .addNode('find_sentiment', find_sentiment)
        .addNode('positive_response', positive_response)
        .addNode('run_diagnosis', run_diagnosis)
        .addNode('negative_response', negative_response)

        .addEdge("__start__", "find_sentiment")
        .addConditionalEdges("find_sentiment", check_sentiment)
        .addEdge("positive_response", "__end__")
        .addEdge("run_diagnosis", "negative_response")
        .addEdge("negative_response", "__end__")
        .compile()


    const data = await graph.invoke({ review: review });
    res.json(data)


})

export const reviewRoutes = router
