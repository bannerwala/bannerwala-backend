
//  Get all subscriptionPlans
export const getAllSubscriptionPlans = async (req, res) => {
    try {
        const name = req.query.name;

        let filter = {};

        // Step 1: If name is provided, find subscriptionPlan
        if (name) {
            filter.name = { $regex: name, $options: 'i' };
        }

        let subscriptionPlans = await SubscriptionPlan.find(filter);
        console.log(subscriptionPlans);

        res.json(subscriptionPlans);
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
}

// Create a new subscriptionPlan
export const AddSubscriptionPlan = async (req, res) => {
    try {
        const { name, price, duration, description, status } = req.body;

        if (!name || !price || !duration || !description || !status) {
            return res.status(400).json({ error: 'name, price, duration, description and status are required' });
        }

        const subscriptionPlan = new SubscriptionPlan({ name, price, duration, description, status });
        await subscriptionPlan.save();

        return res.status(201).json(subscriptionPlan);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
}

// Get a single subscriptionPlan
export const getSingleSubscriptionPlan = async (req, res) => {
    try {
        const subscriptionPlan = await SubscriptionPlan.findById(req.params.id);
        if (!subscriptionPlan) {
            return res.status(404).json({ error: 'SubscriptionPlan not found' });
        }
        res.json(subscriptionPlan);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
}

// Update a subscriptionPlan
export const updateSubscriptionPlan = async (req, res) => {
    try {
        const { name, price, duration, description, status } = req.body;
        const subscriptionPlan = await SubscriptionPlan.findByIdAndUpdate(req.params.id, { name, price, duration, description, status }, { new: true });
        if (!subscriptionPlan) {
            return res.status(404).json({ error: 'SubscriptionPlan not found' });
        }
        res.json(subscriptionPlan);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
}

// Delete a subscriptionPlan
export const deleteSubscriptionPlan = async (req, res) => {
    try {
        const subscriptionPlan = await SubscriptionPlan.findByIdAndDelete(req.params.id);
        if (!subscriptionPlan) {
            return res.status(404).json({ error: 'SubscriptionPlan not found' });
        }
        res.json(subscriptionPlan);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
}

