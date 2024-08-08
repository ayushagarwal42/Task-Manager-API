const express = require("express");
const router = express.Router();

//model
const Task = require("../models/taskModel");
const User = require("../models/userModel");

//middleware
const auth = require('../middlewares/auth');

//task routes 

router.post("/newtasks", auth, async (req, res) => {
    try {
        const { tasks } = req.body;
        // Validate input
        if (!tasks || !Array.isArray(tasks) || tasks.length === 0) {
            return res.status(400).json({ code: 400, message: 'Please provide an array of tasks' });
        }
        const AllTasks = tasks.map(task => ({
            task: task.task, // Extracting value from request and assigning to schema field
            owner: req.user._id,
            completed: task.completed || false,
            createdAt: new Date(),
            updatedAt: new Date()
        }))
        const result = await Task.insertMany(AllTasks);
        res.status(201).json({ code: 201, message: 'Tasks created successfully', data: result });
    } catch (error) {
        res.status(500).json({ code: 500, message: error.message });
    }
});

// Get all tasks for the authenticated user with pagination
router.get('/usertasks', auth, async (req, res) => {
    try {
        let { page = 1, limit = 10 } = req.query; // Default to page 1, 10 tasks per page
        page = Number(page);
        limit = Number(limit);

        // Ensure page and limit are greater than 0
        if (page <= 0 || limit <= 0) {
            return res.status(400).json({
                code: 400,
                message: 'Page and limit must be greater than 0'
            });
        }

        const totalTasks = await Task.countDocuments({ owner: req.user._id });
        const totalPages = Math.ceil(totalTasks / limit);

        // Check if the requested page exceeds the total number of pages
        if (page > totalPages) {
            return res.status(400).json({
                code: 400,
                message: 'Page exceeds total number of pages',
                data: [],
                currentPageTasksCount: 0,
                totalTasks,
                currentPage: page,
                totalPages
            });
        }

        const tasks = await Task.find({ owner: req.user._id })
            .skip((page - 1) * limit)
            .limit(limit);

        if (!tasks.length) {
            return res.status(404).json({
                code: 404,
                message: 'No tasks found for this user',
            });
        }
        const currentPageTasksCount = tasks.length;

        res.status(200).json({
            code: 200,
            message: 'Tasks retrieved successfully',
            data: tasks,
            currentPageTasksCount,
            totalTasks,
            currentPage: page,
            totalPages
        });
    } catch (error) {
        console.error('Error fetching tasks:', error);
        res.status(500).json({
            code: 500,
            message: error.message,
        });
    }
});


// Get all tasks grouped by user (only if the user exists in the database)
router.get('/alluserstask', auth, async (req, res) => {
    try {
        // Find the authenticated user
        const user = await User.findById(req.user._id);

        // Check if the user exists
        if (!user) {
            return res.status(404).json({
                code: 404,
                message: 'User not found',
            });
        }

        // Fetch all tasks with their owners populated
        const tasks = await Task.find().populate('owner', 'name email');

        if (!tasks.length) {
            return res.status(404).json({
                code: 404,
                message: 'No tasks found',
            });
        }
        // Group tasks by user
        const tasksByUser = tasks.reduce((result, task) => {
            const userId = task.owner._id;
            if (!result[userId]) {
                result[userId] = {
                    user: {
                        _id: task.owner._id,
                        name: task.owner.name,
                        email: task.owner.email,
                    },
                    tasks: []
                };
            }
            result[userId].tasks.push({
                _id: task._id,
                task: task.task,
                completed: task.completed,
                createdAt: task.createdAt,
                updatedAt: task.updatedAt
            });
            return result;
        }, {});

        res.status(200).json({
            code: 200,
            message: 'Tasks retrieved successfully',
            data: tasksByUser
        });
    } catch (error) {
        res.status(500).json({
            code: 500,
            message: error.message,
        });
    }
});

// Update a task by ID (either update details or status or both)
router.patch('/update/:id', auth, async (req, res) => {
    const { id } = req.params;
    const { task, completed } = req.body;

    // Validate at least one field is provided for updating
    if (task === undefined && completed === undefined) {
        return res.status(400).json({
            code: 400,
            message: 'No update fields provided',
        });
    }

    // Ensure completed is a boolean if provided
    if (completed !== undefined && typeof completed !== 'boolean') {
        return res.status(400).json({
            code: 400,
            message: 'Invalid completed status. Must be a boolean.',
        });
    }

    try {
        // Find and update the task
        const updatedTask = await Task.findOneAndUpdate(
            { _id: id, owner: req.user._id },
            { $set: { task, completed } }, // Update both fields if provided
            { new: true }  // Return the updated document
        );

        if (!updatedTask) {
            return res.status(404).json({
                code: 404,
                message: 'Task not found',
            });
        }

        res.status(200).json({
            code: 200,
            message: 'Task updated successfully',
            data: updatedTask
        });
    } catch (error) {
        res.status(500).json({
            code: 500,
            message: error.message,
        });
    }
});

// Delete a task by ID
router.delete('/deletetask/:id', auth, async (req, res) => {
    try {
        const task = await Task.findOneAndDelete({ _id: req.params.id, owner: req.user._id });

        if (!task) {
            return res.status(404).json({
                code: 404,
                message: 'Task not found',
            });
        }

        res.status(200).json({
            code: 200,
            message: 'Task deleted successfully',
            data: task
        });
    } catch (error) {
        res.status(500).json({
            code: 500,
            message: error.message,
        });
    }
});

// Delete selected tasks by their IDs
router.delete('/deleteselectedtasks', auth, async (req, res) => {
    try {
        // Get the IDs of tasks to delete from the request body
        const { taskIds } = req.body;

        // Validate that taskIds is an array and not empty
        if (!Array.isArray(taskIds) || taskIds.length === 0) {
            return res.status(400).json({
                code: 400,
                message: 'No task IDs provided',
            });
        }

        // Delete tasks where the ID is in the provided array and the owner matches the authenticated user
        const result = await Task.deleteMany({ _id: { $in: taskIds }, owner: req.user._id });

        // Check if any tasks were deleted
        if (result.deletedCount === 0) {
            return res.status(404).json({
                code: 404,
                message: 'No tasks found to delete',
            });
        }

        res.status(200).json({
            code: 200,
            message: 'Tasks deleted successfully',
            data: result,
        });
    } catch (error) {
        res.status(500).json({
            code: 500,
            message: error.message,
        });
    }
});

// Delete all tasks for the authenticated user
router.delete('/deletealltasks', auth, async (req, res) => {
    try {
        // Delete all tasks where the owner matches the authenticated user
        const result = await Task.deleteMany({ owner: req.user._id });

        // Check if any tasks were deleted
        if (result.deletedCount === 0) {
            return res.status(404).json({
                code: 404,
                message: 'No tasks found to delete',
            });
        }

        res.status(200).json({
            code: 200,
            message: 'All tasks deleted successfully',
            data: result,
        });
    } catch (error) {
        res.status(500).json({
            code: 500,
            message: error.message,
        });
    }
});





module.exports = router;