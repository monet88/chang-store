/**
 * Pose Library Data
 *
 * Structured pose collection data tách khỏi locale files.
 * Labels ở đây là tiếng Anh — nếu cần i18n cho pose titles,
 * thêm key mapping trong locales sau.
 */

export interface PoseItem {
  title: string;
  label: string;      // Detailed pose description (prompt text)
  imageUrl: string;    // GitHub-hosted reference image
}

export interface PoseCollection {
  title: string;
  poses: PoseItem[];
}

export const POSE_COLLECTIONS: PoseCollection[] = [
  {
    title: 'Mirror Selfies',
    poses: [
      { 
        title: 'Crossed Legs, Leaning, Phone Hiding Face', 
        label: "The model stands with her torso slightly angled and one hip pushed out. One leg is crossed over the other, with the knees close together, creating an elegant curve. She holds her phone in front of her with one hand, obscuring part of her expression. The other hand rests naturally on her thigh. Expression: playful and feminine, focusing on the body's curves.", 
        imageUrl: 'https://raw.githubusercontent.com/tuantrinhhyhy1999/image-for-studio-app/refs/heads/main/Mirror-Selfies-9.jpg' 
      },
      { 
        title: 'Low Squat, Phone Hiding Face', 
        label: 'The model is in a low squat, with her legs bent and close together. Her torso is slightly leaned forward, accentuating her figure. One hand holds the phone in front of her, while the other lightly touches the ground for balance. Expression: chic, candid, and modern, like a natural street-style shot.', 
        imageUrl: 'https://raw.githubusercontent.com/tuantrinhhyhy1999/image-for-studio-app/refs/heads/main/Mirror-Selfies-1.jpg' 
      },
      { 
        title: 'Standing Tall, Hand on Head, Crossed Legs', 
        label: "The model stands tall with her legs crossed at the knees. One arm is bent upwards, with her hand placed on top of her head. The other hand holds her phone in front of her for a mirror selfie. Her torso is slightly twisted to accentuate her body's curves. Expression: confident, stylish, and elegant.", 
        imageUrl: 'https://raw.githubusercontent.com/tuantrinhhyhy1999/image-for-studio-app/refs/heads/main/Mirror-Selfies-2.jpg' 
      },
      { 
        title: 'V-Sign Hand, Lifted Leg', 
        label: 'The model stands with one leg playfully bent up, balancing on the other. She holds her phone in front of her with one hand. The other hand is raised high, making a peace sign ✌️. Her torso is slightly tilted to create a dynamic look. Expression: lively, fun, and trendy.', 
        imageUrl: 'https://raw.githubusercontent.com/tuantrinhhyhy1999/image-for-studio-app/refs/heads/main/Mirror-Selfies-3.jpg' 
      },
      { 
        title: 'One Hand on Chest, Crossed Legs', 
        label: "The model stands with her legs crossed and her body slightly angled. One hand holds her phone in front of her, while the other is placed lightly on her chest. Her torso is tilted to one side to accentuate her body's curves. Expression: elegant, chic, and slightly dramatic.", 
        imageUrl: 'https://raw.githubusercontent.com/tuantrinhhyhy1999/image-for-studio-app/refs/heads/main/Mirror-Selfies-4.jpg' 
      },
      { 
        title: 'Natural Lean, Hand on Hip', 
        label: 'The model stands with one leg extended forward and her torso slightly leaning back. One hand is on her hip, creating a confident pose. The other hand holds her phone, obscuring her face. Expression: bold, relaxed, and fashionable.', 
        imageUrl: 'https://raw.githubusercontent.com/tuantrinhhyhy1999/image-for-studio-app/refs/heads/main/Mirror-Selfies-5.jpg' 
      },
      { 
        title: 'Kneeling Pose, One Hand on Thigh', 
        label: 'The model kneels on one leg, with the other bent forward in a triangular shape. She holds her phone in front of her with one hand. The other hand is placed on her thigh for balance. Expression: intimate, stylish, and striking.', 
        imageUrl: 'https://raw.githubusercontent.com/tuantrinhhyhy1999/image-for-studio-app/refs/heads/main/Mirror-Selfies-6.jpg' 
      },
      { 
        title: 'Kneeling on Knees, Hand on Chest', 
        label: "The model is kneeling on the ground. Her body is slightly arched back to emphasize her curves. One hand holds her phone in front of her, while the other rests gently on her chest. Expression: elegant, sensual, and fashion-focused.", 
        imageUrl: 'https://raw.githubusercontent.com/tuantrinhhyhy1999/image-for-studio-app/refs/heads/main/Mirror-Selfies-7.jpg' 
      },
      { 
        title: 'Kneeling Forward, One Hand on Thigh, Head Tilted', 
        label: 'The model kneels on both legs, with her torso slightly leaning forward. One hand holds her phone in front of her, and the other rests on her thigh. Her head is tilted to one side, creating a natural look. Expression: confident yet candid, perfect for a stylish mirror selfie.', 
        imageUrl: 'https://raw.githubusercontent.com/tuantrinhhyhy1999/image-for-studio-app/refs/heads/main/Mirror-Selfies-8.jpg' 
      },
    ],
  },
  {
    title: 'Stand by the wall',
    poses: [
      { 
        title: 'Hands in Front, One Leg Kicked Back', 
        label: 'Both hands are placed in front, holding a handbag casually. One leg is bent at the knee and kicked backward, showing a dynamic and playful vibe. The other leg is straight, firmly planting the pose. A joyful and candid expression adds to the lively and dynamic mood of the shot.', 
        imageUrl: 'https://raw.githubusercontent.com/tuantrinhhyhy1999/image-for-studio-app/refs/heads/main/stand%20by%20the%20wall%20(6).jpg' 
      },
      { 
        title: 'Hands on Hips, Crossed Legs', 
        label: "Both hands are placed firmly on the waist in a confident 'power pose'. The legs are crossed casually, adding a touch of elegance. The lips are slightly pursed in a playful expression, almost like blowing a kiss. The pose exudes boldness while maintaining a feminine balance.", 
        imageUrl: 'https://raw.githubusercontent.com/tuantrinhhyhy1999/image-for-studio-app/refs/heads/main/stand%20by%20the%20wall%20(4).jpg' 
      },
      { 
        title: 'Leaning, Leg Bent, Holding Flowers', 
        label: 'The model holds a bouquet of flowers in one hand, positioned near her chest. The body is slightly tilted to one side, creating a dynamic and playful angle. One leg is bent at the knee, lifting the shoe off the ground. The other leg is firmly planted. The head is slightly turned with a charming smile, giving a joyful and flirtatious feel.', 
        imageUrl: 'https://raw.githubusercontent.com/tuantrinhhyhy1999/image-for-studio-app/refs/heads/main/stand%20by%20the%20wall%20(2).jpg' 
      },
      { 
        title: 'Arms Crossed, Head Tilted, Legs Crossed', 
        label: "The model's arms are crossed over her chest, with a handbag tucked under one arm. She has a slight head tilt to one side, adding a soft and approachable touch. The legs are crossed at the knees, creating a chic, model-like pose. The overall pose gives a relaxed yet stylish feel, perfect for a natural fashion look.", 
        imageUrl: 'https://raw.githubusercontent.com/tuantrinhhyhy1999/image-for-studio-app/refs/heads/main/stand%20by%20the%20wall%20(3).jpg' 
      },
      { 
        title: 'Hand on Forehead, One Leg Straight, One Bent', 
        label: 'One hand is raised, placed gently on the forehead as if shielding from the sun or in a playful, thoughtful gesture. The other hand holds a bouquet of flowers, letting it hang naturally by her side. One leg is straight, supporting the weight. The other leg is slightly bent, turned inward to balance the body. The pose combines grace and softness, with a slightly tilted expression.', 
        imageUrl: 'https://raw.githubusercontent.com/tuantrinhhyhy1999/image-for-studio-app/refs/heads/main/stand%20by%20the%20wall%20(5).jpg' 
      },
      { 
        title: 'Hand in Front, Hand on Hip, Crossed Legs', 
        label: 'The model stands tall against a wall backdrop. One hand is gently placed in front of the body, lightly touching the coat. The other hand rests on the hip, creating a natural gesture. The legs are crossed at the ankles, with one leg relaxed in front, creating a casual feminine pose. Expression: a relaxed smile, confident yet soft.', 
        imageUrl: 'https://raw.githubusercontent.com/tuantrinhhyhy1999/image-for-studio-app/refs/heads/main/stand%20by%20the%20wall%20(1).jpg' 
      },
    ],
  },
  {
    title: 'Sit on the chair',
    poses: [
      { 
        title: 'Hand on Head, Crossed Legs', 
        label: 'The model sits on a folding chair with her torso slightly angled. One arm is raised, with her hand placed on top of her head, fingers slightly running through her hair. The other hand rests naturally on her thigh. Her legs are elegantly crossed at the knees, with one foot pointing forward and the other relaxed behind. Expression: calm, stylish, with a touch of feminine confidence.', 
        imageUrl: 'https://raw.githubusercontent.com/tuantrinhhyhy1999/image-for-studio-app/refs/heads/main/sit-on-the-chair-7.jpg' 
      },
      { 
        title: 'Upright Pose, Crossed Legs, Hand on Lap', 
        label: 'The model sits with a straight back, shoulders relaxed back. One hand rests naturally on her lap, while the other is placed beside the chair. Her legs are crossed at the knees, with her feet pointing forward. The outfit highlights a chic and elegant sitting posture. Expression: her gaze is directed forward, conveying a sophisticated, high-fashion look.', 
        imageUrl: 'https://raw.githubusercontent.com/tuantrinhhyhy1999/image-for-studio-app/refs/heads/main/sit-on-the-chair-1.jpg' 
      },
      { 
        title: 'Hand on Hip, Leaning Pose', 
        label: 'The model slightly leans to one side while sitting. One hand is placed on her hip, with the elbow bent outward for an edgy touch. The other hand is draped lightly across her body, near her chest. Her legs are crossed at the knees, with one foot pointing down naturally. Expression: confident and playful, with a modern-chic style.', 
        imageUrl: 'https://raw.githubusercontent.com/tuantrinhhyhy1999/image-for-studio-app/refs/heads/main/sit-on-the-chair-2.jpg' 
      },
      { 
        title: 'Fingers on Face, Candid Style', 
        label: 'The model sits with a slightly curved back. One elbow rests on her thigh, with her hand gently touching her cheek in a peace sign. The other hand rests lightly on her lap. Her legs are crossed casually, with her feet pointing forward. Expression: slightly playful, inspired by fashion magazines.', 
        imageUrl: 'https://raw.githubusercontent.com/tuantrinhhyhy1999/image-for-studio-app/refs/heads/main/sit-on-the-chair-3.jpg' 
      },
      { 
        title: 'Looking Down, Elegant Leaning Pose', 
        label: 'The model slightly bows her head, her eyes looking downward for a gentle expression. One hand brushes her hair near her ear. The other hand rests on her thigh. Her legs are crossed, with one leg extended forward, toes pointed slightly downward. Expression: soft, dreamy, and graceful.', 
        imageUrl: 'https://raw.githubusercontent.com/tuantrinhhyhy1999/image-for-studio-app/refs/heads/main/sit-on-the-chair-4.jpg' 
      },
      { 
        title: 'Relaxed, Leaning Back, Legs Forward', 
        label: 'The model slightly leans back in the chair. One hand rests naturally on the chair, while the other hangs loosely by her side. Her legs are straight, not crossed, with one leg slightly extended forward. The pose creates a confident, relaxed vibe.', 
        imageUrl: 'https://raw.githubusercontent.com/tuantrinhhyhy1999/image-for-studio-app/refs/heads/main/sit-on-the-chair-5.jpg' 
      },
      { 
        title: 'Leaning Forward, Hands Resting, Crossed Legs', 
        label: 'The model leans forward slightly from the waist, creating a more intimate, engaging look. Both hands rest naturally on her lap. Her legs are crossed at the knees, with her feet pointing down gently. Expression: approachable yet fashionable, like a candid moment.', 
        imageUrl: 'https://raw.githubusercontent.com/tuantrinhhyhy1999/image-for-studio-app/refs/heads/main/sit-on-the-chair-6.jpg' 
      },
    ],
  },
  {
    title: 'In The Park',
    poses: [
      { 
        title: 'Hands Covering Face, Crossed Legs', 
        label: "The model stands on the grass with her weight on one leg. Her legs are crossed at the calves, creating a casual and feminine pose. Both hands are raised, gently covering the lower part of her face in a playful, shy expression. Her shoulders are relaxed, and her body is slightly hunched forward, giving a cute, bashful feel.", 
        imageUrl: 'https://raw.githubusercontent.com/tuantrinhhyhy1999/image-for-studio-app/refs/heads/main/In-The-Park-6.jpg' 
      },
      { 
        title: 'Hand Shielding Sun, One Leg Forward', 
        label: 'The model places one hand on her forehead as if shielding her eyes from the sun. The other hand hangs naturally by her side while holding a small handbag. One leg is straight, supporting her weight. The other leg is slightly crossed in front, with the toe pointed downward. Expression: smiling with a slight squint, giving a fresh, sunny-day vibe.', 
        imageUrl: 'https://raw.githubusercontent.com/tuantrinhhyhy1999/image-for-studio-app/refs/heads/main/In-The-Park-1.jpg' 
      },
      { 
        title: 'Touching Hair, Side Glance', 
        label: 'The model uses one hand to touch her hair near her ear, creating a soft, natural gesture. Her gaze is slightly turned to the side, as if looking at something in the distance. Both legs are straight and together, creating a clean silhouette. The other hand holds a handbag by her side, balancing the pose.', 
        imageUrl: 'https://raw.githubusercontent.com/tuantrinhhyhy1999/image-for-studio-app/refs/heads/main/In-The-Park-2.jpg' 
      },
      { 
        title: 'Peace Sign Hand, One Leg Bent', 
        label: 'The model raises one hand high above her head, making a playful peace sign ✌️. The other hand hangs down naturally, holding a handbag. One leg is bent back at the knee, lifting the foot in a joyful manner. The body is slightly tilted, and the expression is lively and energetic, as if celebrating.', 
        imageUrl: 'https://raw.githubusercontent.com/tuantrinhhyhy1999/image-for-studio-app/refs/heads/main/In-The-Park-3.jpg' 
      },
      { 
        title: 'Hand Covering Face, Peace Sign, Crossed Legs', 
        label: 'The model raises one hand to cover her smile in a shy, playful way. The other hand is held high, making a peace sign ✌️. Her legs are crossed at the knees, elongating her figure. The pose looks graceful and dynamic, mixing bashfulness with energy.', 
        imageUrl: 'https://raw.githubusercontent.com/tuantrinhhyhy1999/image-for-studio-app/refs/heads/main/In-The-Park-4.jpg' 
      },
      { 
        title: 'Head Tilted, Peace Sign, Eyes Closed', 
        label: 'The model tilts her head to one side while smiling gently. Her eyes are closed, giving a dreamy and relaxed feel. One hand is raised, making a peace sign ✌️ near her shoulder level. The other hand hangs naturally, holding a handbag. Her legs are kept straight and together, a simple yet elegant stance.', 
        imageUrl: 'https://raw.githubusercontent.com/tuantrinhhyhy1999/image-for-studio-app/refs/heads/main/In-The-Park-5.jpg' 
      },
    ],
  },
  {
    title: 'At the Cafe',
    poses: [
      { 
        title: 'Leaning on Counter, Holding Drink', 
        label: 'The model stands beside a counter, with one hand resting lightly on the surface. The other hand holds a coffee cup near her waist. Her legs are elegantly crossed, creating a natural curve. Her head is slightly turned to the right, with a chic and stylish expression.', 
        imageUrl: 'https://raw.githubusercontent.com/tuantrinhhyhy1999/image-for-studio-app/refs/heads/main/Coffe-Shop-6.jpg' 
      },
      { 
        title: 'Confident Outdoor Pose, Hand on Hip', 
        label: 'The model stands with a slight lean back, her torso angled. One hand is placed on her hip while the other hangs naturally, holding a coffee cup. Her gaze is directed forward, wearing sunglasses for a bold look. Her legs are straight and the pose exudes confidence.', 
        imageUrl: 'https://raw.githubusercontent.com/tuantrinhhyhy1999/image-for-studio-app/refs/heads/main/Coffe-Shop-1.jpg' 
      },
      { 
        title: 'Sitting Cross-legged, Holding Coffee', 
        label: 'The model sits casually outdoors on a step. Her legs are neatly crossed at the knees, emphasizing a slender silhouette. One hand is placed behind her for support, while the other holds a coffee cup resting on her leg. She looks straight ahead, conveying a calm and fashionable vibe.', 
        imageUrl: 'https://raw.githubusercontent.com/tuantrinhhyhy1999/image-for-studio-app/refs/heads/main/Coffe-Shop-2.jpg' 
      },
      { 
        title: 'Standing with Two Hands on Coffee Cup', 
        label: 'The model stands tall, holding a coffee cup with both hands near her waist. One leg is stepped slightly forward, creating balance and length. Her head is turned to the left, and she wears sunglasses, expressing a calm confidence. Overall style: elegant and minimalist.', 
        imageUrl: 'https://raw.githubusercontent.com/tuantrinhhyhy1999/image-for-studio-app/refs/heads/main/Coffe-Shop-3.jpg' 
      },
      { 
        title: 'Low Squat, Hands Extended', 
        label: 'The model is in a low squat, with her legs folded neatly. Both hands are extended forward, resting lightly on her legs, with one hand holding a coffee cup. Her gaze is directed at the camera with a cool, urban street-style attitude. The pose emphasizes a relaxed yet stylish energy.', 
        imageUrl: 'https://raw.githubusercontent.com/tuantrinhhyhy1999/image-for-studio-app/refs/heads/main/Coffe-Shop-4.jpg' 
      },
      { 
        title: 'Hands on Hips, Looking Down', 
        label: 'The model stands at a counter, both hands placed firmly on her hips. One leg is slightly forward, adding depth to the stance. Her head is bowed, with her eyes looking downward for a subtle, elegant look. Expression: confident, chic, and sophisticated.', 
        imageUrl: 'https://raw.githubusercontent.com/tuantrinhhyhy1999/image-for-studio-app/refs/heads/main/Coffe-Shop-5.jpg' 
      },
    ],
  },
];
