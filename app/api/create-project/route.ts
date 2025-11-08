import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.NEXT_PUBLIC_GEMINI_API_KEY || '');

export async function POST(request: NextRequest) {
  try {
    const { project, uid, profile } = await request.json();

    if (!project || !uid || !profile) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

    const prompt = `
You are a project planning AI. Generate a detailed roadmap for this project:

Project: ${project.title}
Description: ${project.description}
Difficulty: ${project.difficulty}

User profile:
- Skills: ${profile.skills?.join(', ') || 'general programming'}
- Experience: ${profile.experience || 'beginner'}

Create a roadmap with 4-6 milestones. Each milestone should have 3-5 tasks.

Return ONLY a JSON object with this exact structure:
{
  "milestones": [
    {
      "id": "m1",
      "title": "Milestone Title",
      "description": "What will be accomplished",
      "estimatedHours": 8,
      "tasks": [
        {
          "id": "t1",
          "title": "Task Title",
          "description": "Detailed task description",
          "estimatedHours": 2,
          "difficulty": "easy" | "medium" | "hard",
          "requiredSkills": ["Skill1", "Skill2"],
          "resources": [
            {
              "title": "Resource Title",
              "url": "https://example.com",
              "type": "article" | "video" | "documentation"
            }
          ],
          "done": false,
          "locked": true
        }
      ]
    }
  ]
}

Important:
- Make sure task IDs are sequential (t1, t2, t3...) across all milestones
- Set locked: false ONLY for the very first task (m1.t1)
- All other tasks should have locked: true
- Include real, helpful resource URLs
- Make tasks specific and actionable

Return ONLY valid JSON, no markdown.
`;

    const result = await model.generateContent(prompt);
    const response = result.response;
    const responseText = response.text();
    
    let cleanedText = responseText.trim();
    if (cleanedText.startsWith('\`\`\`json')) {
      cleanedText = cleanedText.replace(/^\`\`\`json\n/, '').replace(/\n\`\`\`$/, '');
    } else if (cleanedText.startsWith('\`\`\`')) {
      cleanedText = cleanedText.replace(/^\`\`\`\n/, '').replace(/\n\`\`\`$/, '');
    }

    const roadmap = JSON.parse(cleanedText);

    // Unlock first task
    if (roadmap.milestones?.[0]?.tasks?.[0]) {
      roadmap.milestones[0].tasks[0].locked = false;
    }

    // Calculate total tasks
    let totalTasks = 0;
    roadmap.milestones?.forEach((m: any) => {
      totalTasks += m.tasks?.length || 0;
    });

    // Return project data for client to save
    const projectData = {
      ownerId: uid,
      title: project.title,
      description: project.description,
      difficulty: project.difficulty,
      estimatedTime: project.estimatedTime,
      stack: project.stack || [],
      createdAt: new Date(),
      updatedAt: new Date(),
      status: 'active',
      roadmap: roadmap,
      progress: {
        completedTasks: 0,
        totalTasks: totalTasks,
        progressPercent: 0,
      },
    };

    return NextResponse.json({ 
      projectData,
      roadmap: roadmap
    });
  } catch (error: any) {
    console.error('Error creating project:', error);
    return NextResponse.json(
      { error: 'Failed to create project', details: error.message },
      { status: 500 }
    );
  }
}
