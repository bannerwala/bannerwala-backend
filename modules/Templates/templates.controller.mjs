import Category from '../Categories/Category.mjs';
import SubCategory from '../Sub-Categories/SubCategory.mjs';
import SubscriptionPlan from '../SubscriptionPlans/SubscriptionPlan.mjs';
import { processPSD, uploadPngStream } from './template.helper.mjs';
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

export const getTemplateById = async (req, res) => {
    try {
        const { id } = req.params;

        if (!id) {
            return res.status(400).json({ error: "id is required" });
        }


        const template = await Template.findById(id)
            .populate("plans", "name")
            .populate("categories", "name")
            .populate("sub_categories", "name")
            .lean();

        if (!template) {
            return res.status(404).json({
                message: "Template not found"
            });
        }

        return res.status(200).json({
            message: "Template fetched successfully",
            data: template
        });

    } catch (error) {
        console.error("Error fetching template:", error);
        return res.status(500).json({
            message: "Failed to fetch template",
            error: error.message
        });
    }
};

// Add template
export const addTemplate = async (req, res) => {
    try {
        const {
            categories,
            sub_categories,
            plans,
            font_family,
            font_size,
            font_color,
            has_multiple_images
        } = req.body;
        console.log('req.body: ', req.body);

        console.log('req.file: ', req.file);
        if (!req.file) {
            return res.status(400).json({ error: "PSD file is required" });
        }

        /* ===== Validate Relations ===== */

        const existing_categories = await Category.find({ name: { $in: categories } });
        console.log('existing_categories: ', existing_categories);
        if (!existing_categories.length)
            return res.status(404).json({ error: "Categories not found" });

        const existing_sub_categories = await SubCategory.find({ name: { $in: sub_categories } });
        console.log('existing_sub_categories: ', existing_sub_categories);
        if (!existing_sub_categories.length)
            return res.status(404).json({ error: "Subcategories not found" });

        const existing_plans = await SubscriptionPlan.find({ name: { $in: plans } });
        console.log('existing_plans: ', existing_plans);
        if (!existing_plans.length)
            return res.status(404).json({ error: "Plans not found" });

        /* ===== Generate Layout From PSD ===== */

        console.log("🚀 Processing PSD...");

        console.log('req.file: ', req.file);
        const { layout, thumbnail } = await processPSD(req.file.path);

        console.log("✅ Layout generated");

        /* ===== Save Template ===== */

        const template = new Template({
            layout,
            url: thumbnail,
            categories: existing_categories.map(c => c._id),
            sub_categories: existing_sub_categories.map(s => s._id),
            plans: existing_plans.map(p => p._id),
            font_family,
            font_size,
            font_color,
            has_multiple_images
        });

        await template.save();

        res.status(201).json({
            message: "Template created successfully",
            template
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
};

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

//Get all template urls
export const getAllTemplateUrls = async (req, res) => {
    try {
        const templates = await Template.find(
            { url: { $exists: true, $ne: null } }, // only documents with url
            { _id: 0, url: 1 } // return only url field
        ).lean();

        // Convert to simple array if needed
        const urls = templates.map(t => t.url);

        return res.status(200).json({
            count: urls.length,
            urls
        });

    } catch (error) {
        console.error("Error fetching template URLs:", error);
        return res.status(500).json({
            message: "Failed to fetch URLs",
            error: error.message
        });
    }
};
