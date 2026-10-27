import { Activity, Team, User, Workout } from '../models/index.js';

export async function listActivities() {
  return Activity.find().lean();
}

export async function createActivity(input: unknown) {
  const badRequest = (message: string) => Object.assign(new Error(message), { status: 400 });
  if (!input || typeof input !== 'object') throw badRequest('Activity payload is required');

  const { userId, teamId, type, minutes } = input as Record<string, unknown>;
  if (
    typeof userId !== 'string' || !/^[a-f\d]{24}$/i.test(userId) ||
    typeof teamId !== 'string' || !/^[a-f\d]{24}$/i.test(teamId) ||
    typeof type !== 'string' || !type.trim() ||
    typeof minutes !== 'number' || !Number.isFinite(minutes) || minutes <= 0
  ) {
    throw badRequest('Activity requires valid userId, teamId, type, and positive minutes');
  }

  const [userExists, teamExists] = await Promise.all([
    User.exists({ _id: userId }),
    Team.exists({ _id: teamId }),
  ]);
  if (!userExists || !teamExists) throw badRequest('Activity user or team does not exist');

  return Activity.create({
    user: userId,
    team: teamId,
    type: type.trim(),
    minutes,
    points: minutes,
    occurredAt: new Date(),
  });
}

export async function listTeams() {
  return Team.find().lean();
}

export async function createTeam(input: unknown) {
  const badRequest = (message: string) => Object.assign(new Error(message), { status: 400 });
  if (!input || typeof input !== 'object') throw badRequest('Team payload is required');

  const { name, mascot, members = [] } = input as Record<string, unknown>;
  if (typeof name !== 'string' || !name.trim() || typeof mascot !== 'string' || !mascot.trim()) {
    throw badRequest('Team name and mascot are required');
  }
  if (!Array.isArray(members) || !members.every((member) => typeof member === 'string' && /^[a-f\d]{24}$/i.test(member))) {
    throw badRequest('Team members must be valid user IDs');
  }

  const memberIds = [...new Set(members as string[])];
  if (memberIds.length && await User.countDocuments({ _id: { $in: memberIds } }) !== memberIds.length) {
    throw badRequest('One or more team members do not exist');
  }

  return Team.create({ name: name.trim(), mascot: mascot.trim(), members: memberIds });
}

export async function getLeaderboard() {
  const teams = await Team.aggregate([
    {
      $lookup: {
        from: Activity.collection.name,
        localField: '_id',
        foreignField: 'team',
        as: 'activities',
      },
    },
    {
      $project: {
        _id: 0,
        teamName: '$name',
        totalPoints: { $sum: '$activities.points' },
      },
    },
    { $sort: { totalPoints: -1, teamName: 1 } },
  ]);

  return teams.map((team, index) => ({ ...team, rank: index + 1 }));
}

export async function suggestWorkouts(userEmail: string) {
  const user = await User.findOne({ email: userEmail.trim().toLowerCase() }).lean();
  if (!user) throw Object.assign(new Error('User not found'), { status: 404 });

  const [recentActivity, workouts] = await Promise.all([
    Activity.findOne({ user: user._id }).sort({ occurredAt: -1 }).lean(),
    Workout.find().lean(),
  ]);
  const normalize = (value: string | undefined) => value?.trim().toLowerCase();
  const goal = normalize(user.fitnessGoal);
  const recentType = normalize(recentActivity?.type);
  const matchesGoal = (workout: (typeof workouts)[number]) => normalize(workout.focus) === goal;
  const matchesRecentActivity = (workout: (typeof workouts)[number]) => normalize(workout.focus) === recentType;
  const orderedWorkouts = [
    ...workouts.filter(matchesGoal),
    ...workouts.filter((workout) => !matchesGoal(workout) && matchesRecentActivity(workout)),
    ...workouts.filter((workout) => !matchesGoal(workout) && !matchesRecentActivity(workout)),
  ];

  return orderedWorkouts.map((workout) => ({
    ...workout,
    reason: matchesGoal(workout)
      ? `Matches your ${user.fitnessGoal} fitness goal.`
      : matchesRecentActivity(workout)
        ? `Builds on your recent ${recentActivity?.type} activity.`
        : `Recommended to support your ${user.fitnessGoal} fitness goal.`,
  }));
}

export { User };
