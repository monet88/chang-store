export interface PredefinedBackground {
    id: string;
    name: string;
    thumbnailUrl: string;
    prompt: string;
}

export const PREDEFINED_BACKGROUNDS: PredefinedBackground[] = [
    {
        id: 'warm_studio',
        name: 'Warm Studio',
        thumbnailUrl: 'https://storage.googleapis.com/aistudio-ux-team/seed_images/predefined_bgs/warm_studio.png',
        prompt: 'A professional photography studio with a warm, off-white seamless paper backdrop. The lighting is soft and diffused, coming from a large softbox on the left, creating gentle shadows on the right. The floor is a light, polished concrete that reflects some of the soft light.'
    },
    {
        id: 'cool_gray',
        name: 'Cool Gray',
        thumbnailUrl: 'https://storage.googleapis.com/aistudio-ux-team/seed_images/predefined_bgs/cool_gray.png',
        prompt: 'A modern, minimalist photography studio with a cool-toned, medium-gray seamless backdrop. The scene is evenly lit with clean, neutral light, minimizing shadows. The floor is a smooth, matte gray surface that matches the backdrop.'
    },
    {
        id: 'textured_concrete',
        name: 'Textured Concrete',
        thumbnailUrl: 'https://storage.googleapis.com/aistudio-ux-team/seed_images/predefined_bgs/textured_concrete.png',
        prompt: 'An industrial-style studio featuring a textured, raw concrete wall as the backdrop. A single, strong light source from the top right creates dramatic, defined shadows. The floor is dark, polished concrete, adding to the moody, high-fashion atmosphere.'
    },
    {
        id: 'vibrant_color',
        name: 'Vibrant Color',
        thumbnailUrl: 'https://storage.googleapis.com/aistudio-ux-team/seed_images/predefined_bgs/vibrant_color.png',
        prompt: 'A bold, energetic studio setting with a seamless backdrop in a vibrant, saturated teal color. The lighting is bright and even, making the color pop. The floor is a clean white, reflecting the colorful background.'
    },
    {
        id: 'daylight_loft',
        name: 'Daylight Loft',
        thumbnailUrl: 'https://storage.googleapis.com/aistudio-ux-team/seed_images/predefined_bgs/daylight_loft.png',
        prompt: 'A bright, airy loft studio with a large industrial window letting in streams of natural daylight. The backdrop is a distressed white brick wall. The floor is made of light-colored, worn wooden planks. The lighting should feel natural and soft.'
    },
    {
        id: 'dark_moody',
        name: 'Dark & Moody',
        thumbnailUrl: 'https://storage.googleapis.com/aistudio-ux-team/seed_images/predefined_bgs/dark_moody.png',
        prompt: 'A dramatic studio setting with a dark charcoal or black seamless backdrop. The lighting is low-key and directional, sculpting the subject with light and creating deep, soft shadows. The atmosphere is intimate and sophisticated.'
    },
];
