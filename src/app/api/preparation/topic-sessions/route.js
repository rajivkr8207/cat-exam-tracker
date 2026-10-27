import { connectDB } from "@/config/database";
import { getAuthenticatedUser } from "@/lib/auth";
import { isValidTaskDate } from "@/lib/task-api";
import {
  parseObjectId,
  topicApiError,
  validateTopicSessionPayload,
} from "@/lib/topic-api";
import TaskTracker from "@/models/task.model";
import Topic from "@/models/Topic.model";
import TopicSession from "@/models/TopicSession.model";

function escapeRegex(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function GET(request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return Response.json({ error: "Authentication required" }, { status: 401 });
    }

    const search = new URL(request.url).searchParams;
    const topic = search.get("topic");
    const section = search.get("section");
    const relatedTaskId = search.get("relatedTaskId");
    const from = search.get("from");
    const to = search.get("to");
    const limit = Math.min(1000, Math.max(1, Number(search.get("limit")) || 500));

    if (relatedTaskId && !parseObjectId(relatedTaskId)) {
      return Response.json({ error: "Invalid related task ID" }, { status: 400 });
    }

    const filter = { userId: user._id };
    if (relatedTaskId) filter.relatedTaskId = relatedTaskId;
    if (section && section !== "All") {
      filter.section = section;
    }
    if (topic && topic.trim()) {
      filter.topic = { $regex: topic.trim(), $options: "i" };
    }
    if (from || to) {
      filter.date = {};
      if (from && isValidTaskDate(from)) filter.date.$gte = from;
      if (to && isValidTaskDate(to)) filter.date.$lte = to;
    }

    await connectDB();
    const sessions = await TopicSession.find(filter)
      .sort({ date: -1, createdAt: -1 })
      .limit(limit)
      .lean();

    return Response.json({ sessions });
  } catch (error) {
    return topicApiError(error);
  }
}

export async function POST(request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return Response.json({ error: "Authentication required" }, { status: 401 });
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: "A valid JSON object is required" }, { status: 400 });
    }

    const validation = validateTopicSessionPayload(body);
    if (validation.error) {
      return Response.json({ error: validation.error }, { status: 400 });
    }

    await connectDB();
    const relatedTaskId = validation.payload.relatedTaskId;
    if (relatedTaskId) {
      const task = await TaskTracker.exists({ _id: relatedTaskId, userId: user._id });
      if (!task) {
        return Response.json({ error: "Related task not found" }, { status: 404 });
      }
    }

    let session;
    let status = 201;
    if (relatedTaskId) {
      session = await TopicSession.findOne({
        userId: user._id,
        relatedTaskId,
      });
      if (session) {
        for (const [field, value] of Object.entries(validation.payload)) {
          session.set(field, value);
        }
        await session.save();
        status = 200;
      } else {
        try {
          session = await TopicSession.create({
            ...validation.payload,
            userId: user._id,
          });
        } catch (error) {
          if (error?.code !== 11000) throw error;
          session = await TopicSession.findOne({
            userId: user._id,
            relatedTaskId,
          });
          if (!session) throw error;
          for (const [field, value] of Object.entries(validation.payload)) {
            session.set(field, value);
          }
          await session.save();
          status = 200;
        }
      }
    } else {
      session = await TopicSession.create({
        ...validation.payload,
        userId: user._id,
      });
    }

    // Optionally sync lastPracticed and nextReview with Topic if matching topic exists
    try {
      const topic = await Topic.findOne({
        userId: user._id,
        section: session.section,
        name: { $regex: new RegExp(`^${escapeRegex(session.topic)}$`, "i") },
      });
      if (topic) {
        let changed = false;
        if (!topic.lastPracticed || session.date >= topic.lastPracticed) {
          topic.lastPracticed = session.date;
          changed = true;
        }
        if (session.revisionDate) {
          topic.nextReview = session.revisionDate;
          changed = true;
        }
        if (changed) {
          await topic.save();
        }
      }
    } catch (syncErr) {
      console.warn("Topic sync after session warning:", syncErr);
    }

    return Response.json({ session }, { status });
  } catch (error) {
    return topicApiError(error);
  }
}
