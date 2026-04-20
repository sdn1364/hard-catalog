import { Box, Image } from "@mantine/core";
import { IconPhoto } from "@tabler/icons-react";

type ProjectCoverPreviewProps = {
  src: string | null;
  height?: number;
};

export function ProjectCoverPreview({
  src,
  height = 160,
}: ProjectCoverPreviewProps) {
  if (!src) {
    return (
      <Box
        h={height}
        style={{
          borderRadius: "var(--mantine-radius-md)",
          border: "1px solid var(--mantine-color-dark-4)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
        bg="dark.6"
      >
        <IconPhoto size={40} stroke={1.25} opacity={0.35} />
      </Box>
    );
  }

  return (
    <Image
      src={src}
      alt=""
      h={height}
      fit="cover"
      radius="md"
      fallbackSrc=""
    />
  );
}
