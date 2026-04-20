import { getSignedImageUrl } from '../../api/uploads3.mjs';
import Category from '../Categories/Category.mjs';
import SubCategory from '../Sub-Categories/SubCategory.mjs';
import SubscriptionPlan from '../SubscriptionPlans/SubscriptionPlan.mjs';
import { processPSD } from './template.helper.mjs';
import Template from './Template.mjs';
import TemplatesActivity from './TemplatesActivity/TemplatesActivity.mjs';

//Get all templates with filters
export const getAllTemplates = async (req, res) => {
    try {
        const { category, sub_category, plans, limit, offset } = req.query;
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

        let query = Template.find(filter)
            .select('-layout')
            .populate('categories')
            .populate('sub_categories')
            .populate('plans');

        if (limit !== undefined) {
            const parsedLimit = parseInt(limit);
            if (!isNaN(parsedLimit) && parsedLimit > 0) {
                query = query.limit(parsedLimit);
            }
        }

        if (offset !== undefined) {
            const parsedOffset = parseInt(offset);
            if (!isNaN(parsedOffset) && parsedOffset >= 0) {
                query = query.skip(parsedOffset);
            }
        }

        const templates = await query.lean();


        for (let template of templates) {
            const activities = await TemplatesActivity.find({
                template: template._id
            })
                .populate("user")
                .sort({ created_at: -1 })
                .lean();

            template.template_activities = activities;
        }

        res.json(templates);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};


export const getTemplateById = async (req, res) => {
    try {
        const { id } = req.params;

        if (!id) {
            return res.status(400).json({ error: "id is required" });
        }

        // 1️⃣ Get template
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

        // 2️⃣ Get activities related to this template
        const activities = await TemplatesActivity.find({
            template: id
        })
            .populate("user")
            .sort({ created_at: -1 })
            .lean();

        // 3️⃣ Attach activities to response (NOT DB)
        template.template_activities = activities;

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
        let {
            categories,
            sub_categories,
            plans,
            font_family,
            font_size,
            font_color,
            has_banner_footer
        } = req.body;
        if (!req.file) {
            return res.status(400).json({ error: "PSD file is required" });
        }

        if (typeof categories === "string") {
            categories = categories.split(",").map(c => c.trim());
        }

        if (typeof sub_categories === "string") {
            sub_categories = sub_categories.split(",").map(s => s.trim());
        }

        if (typeof plans === "string") {
            plans = plans.split(",").map(p => p.trim());
        }


        /* ===== Validate Relations ===== */

        const existing_categories = await Category.find({ name: { $in: categories } });
        // console.log('existing_categories: ', existing_categories);

        if (!existing_categories.length)
            return res.status(404).json({ error: "Categories not found" });

        // Extract selected category IDs
        const categoryIds = existing_categories.map(c => c._id.toString());

        const existing_sub_categories = await SubCategory.find({ name: { $in: sub_categories } });
        if (!existing_sub_categories.length)
            return res.status(404).json({ error: "Subcategories not found" });

        // Validate subcategories belong to selected categories
        for (let sub of existing_sub_categories) {
            const belongs = sub.category.some(catId =>
                categoryIds.includes(catId.toString())
            );

            if (!belongs) {
                return res.status(400).json({
                    error: `Subcategory '${sub.name}' does not belong to selected categories`
                });
            }
        }

        const existing_plans = await SubscriptionPlan.find({ name: { $in: plans } });

        /* ===== Generate Layout From PSD ===== */

        console.log("🚀 Processing PSD...");

        const { layout, thumbnail } = await processPSD(req.file.path);
        console.log('thumbnail: ', thumbnail);

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
            has_banner_footer
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

//update Template
export const updateTemplate = async (req, res) => {
    try {
        let {
            categories,
            sub_categories,
            plans,
            has_banner_footer,
            font_family,
            font_size,
            font_color,
            font_style,
            font_weight
        } = req.body;

        const template = await Template.findById(req.params.id);
        if (!template) {
            return res.status(404).json({ error: 'Template not found' });
        }

        /* ===== Convert comma separated to array ===== */

        if (typeof categories === "string") {
            categories = categories.split(",").map(c => c.trim());
        }

        if (typeof sub_categories === "string") {
            sub_categories = sub_categories.split(",").map(s => s.trim());
        }

        if (plans && typeof plans === "string") {
            plans = plans.split(",").map(p => p.trim());
        }

        /* ===== Validate Categories ===== */

        const existing_categories = await Category.find({
            name: { $in: categories }
        });

        if (existing_categories.length !== categories.length) {
            return res.status(404).json({ error: 'Some categories not found' });
        }

        /* ===== Validate SubCategories (Must Belong To Categories) ===== */

        const existing_sub_categories = await SubCategory.find({
            name: { $in: sub_categories },
            category: { $in: existing_categories.map(c => c._id) }
        });

        if (existing_sub_categories.length !== sub_categories.length) {
            return res.status(400).json({
                error: 'Some subcategories do not belong to selected categories'
            });
        }

        /* ===== Validate Plans ===== */
        if (plans && plans.length !== 0) {
            const existing_plans = await SubscriptionPlan.find({
                name: { $in: plans }
            });

            if (existing_plans.length !== plans.length) {
                return res.status(404).json({ error: 'Some plans not found' });
            }
            template.plans = existing_plans.map(p => p._id);
        }

        /* ===== Update Template ===== */

        template.categories = existing_categories.map(c => c._id);
        template.sub_categories = existing_sub_categories.map(s => s._id);
        template.has_banner_footer = has_banner_footer ?? template.has_banner_footer;
        template.font_family = font_family ?? template.font_family;
        template.font_size = font_size ?? template.font_size;
        template.font_color = font_color ?? template.font_color;
        template.font_style = font_style ?? template.font_style;
        template.font_weight = font_weight ?? template.font_weight;

        await template.save();

        res.json(template);

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};


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

//Get s3 url
export const getImageSignedUrl = async (req, res) => {
    try {
        const { key } = req.query;

        if (!key) {
            return res.status(400).json({ error: "Key is required" });
        }

        const bucketName = "bannerwala";

        const signedUrl = await getSignedImageUrl(bucketName, key);

        return res.status(200).json({
            success: true,
            url: signedUrl,
        });
    } catch (error) {
        console.error("❌ Signed URL error:", error);
        return res.status(500).json({ error: "Failed to generate signed URL" });
    }
};