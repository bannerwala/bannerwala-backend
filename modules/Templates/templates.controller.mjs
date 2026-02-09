import Category from './Category.mjs';
import SubCategory from './SubCategory.mjs';
import Template from './Template.mjs';

//Get all templates with filters
export const getAllTemplates = async (req, res) => {
    try {
        const { category, sub_category, plans, limit: limitStr, offset: offsetStr } = req.query;

        // parse limit and offset, and default values
        const defaultLimit = 10;
        const maxLimit = 10;
        let limit = parseInt(limitStr);
        if (isNaN(limit) || limit < 1) limit = defaultLimit;
        if (limit > maxLimit) limit = maxLimit;

        let offset = parseInt(offsetStr);
        if (isNaN(offset) || offset < 0) offset = 0;

        const filter = {};

        if (plans !== undefined) {
            const existing_plans = await SubscriptionPlan.find({ name: { $regex: plans, $options: 'i' } });
            filter.plans = { $in: existing_plans.map(plan => plan._id) };
        }

        if (category) {
            const existing_categories = await Category.find({ name: { $regex: category, $options: 'i' } });
            filter.categories = { $in: existing_categories.map(category => category._id) };
        }
        if (sub_category) {
            const existing_sub_categories = await SubCategory.find({ name: { $regex: sub_category, $options: 'i' } });
            filter.sub_categories = { $in: existing_sub_categories.map(sub_category => sub_category._id) };
        }

        const templates = await Template.find(filter)
            .populate('categories')
            .populate('sub_categories')
            .populate('plans')
            .skip(offset)
            .limit(limit);
        res.json(templates);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
}

// Add template
export const addTemplate = async (req, res) => {
    try {
        const { url, categories, sub_categories, plans, font_family, font_size, font_color, has_multiple_images } = req.body;

        const existing_categories = await Category.find({ name: { $in: categories } });
        if (existing_categories.length === 0) {
            return res.status(404).json({ error: 'Categories not found' });
        }
        const existing_sub_categories = await SubCategory.find({ name: { $in: sub_categories } });
        if (existing_sub_categories.length === 0) {
            return res.status(404).json({ error: 'Subcategories not found' });
        }
        const existing_plans = await SubscriptionPlan.find({ name: { $in: plans } });
        if (existing_plans.length === 0) {
            return res.status(404).json({ error: 'Plans not found' });
        }

        const templates = new Template({
            url,
            categories: existing_categories.map(category => category._id),
            sub_categories: existing_sub_categories.map(sub_category => sub_category._id),
            plans: existing_plans.map(plan => plan._id),
            font_family,
            font_size,
            font_color,
            has_multiple_images
        });
        console.log('templates: ', templates);

        await templates.save();
        res.json(templates);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
}

// Update template
export const updateTemplate = async (req, res) => {
    try {
        const { url, categories, sub_categories, plans, font_family, font_size, font_color, font_style, font_weight } = req.body;

        const template = await Template.findById(req.params.id);
        if (!template) {
            return res.status(404).json({ error: 'Template not found' });
        }

        const existing_categories = await Category.find({ name: { $in: categories } });
        if (existing_categories.length === 0) {
            return res.status(404).json({ error: 'Categories not found' });
        }
        const existing_sub_categories = await SubCategory.find({ name: { $in: sub_categories } });
        if (existing_sub_categories.length === 0) {
            return res.status(404).json({ error: 'Subcategories not found' });
        }
        const existing_plans = await SubscriptionPlan.find({ name: { $in: plans } });
        if (existing_plans.length === 0) {
            return res.status(404).json({ error: 'Plans not found' });
        }

        template.url = url;
        template.categories = existing_categories.map(category => category._id);
        template.sub_categories = existing_sub_categories.map(sub_category => sub_category._id);
        template.plans = existing_plans.map(plan => plan._id);
        template.font_family = font_family;
        template.font_size = font_size;
        template.font_color = font_color;
        template.font_style = font_style;
        template.font_weight = font_weight;
        await template.save();
        res.json(template);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
}

//Update status of template 
export const updateStatus = async (req, res) => {
    try {
        const { status } = req.body;
        const template = await Template.findByIdAndUpdate(req.params.id, { status });
        if (!template) {
            return res.status(404).json({ error: 'Template not found' });
        }
        res.json(template);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
}

//Delete template
export const deleteTemplate = async (req, res) => {
    try {
        const template = await Template.findByIdAndDelete(req.params.id);
        if (!template) {
            return res.status(404).json({ error: 'Template not found' });
        }
        res.json(template);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
}
